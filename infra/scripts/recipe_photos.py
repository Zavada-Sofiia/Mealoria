"""Generate catalog photos for the recipes with Cloudflare Workers AI (flux-1-schnell).

Usage:
    export CF_ACCOUNT_ID=...   # Cloudflare dashboard -> Workers & Pages -> Account ID
    export CF_API_TOKEN=...    # API token with the "Workers AI" permission
    python3 infra/scripts/recipe_photos.py            # writes infra/scripts/out/<slug>.jpg
    python3 infra/scripts/recipe_photos.py --dry-run  # only prints the prompts

Existing files are skipped, so it is safe to run again after a failure.
Upload the files from out/ to Supabase Storage: bucket dish-photos, folder recipes/.
"""
import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path

MODEL = "@cf/black-forest-labs/flux-1-schnell"
OUT = Path(__file__).parent / "out"
STYLE = "appetizing food photography, top-down view, natural light, wooden table, no text"

# slug: (recipe name in the database, what to draw)
RECIPES = {
    "oatmeal-banana": ("Вівсянка з бананом", "a bowl of oatmeal porridge with sliced banana and honey"),
    "vegetable-omelette": ("Омлет з овочами", "a fluffy omelette with tomato and bell pepper"),
    "syrniki": ("Сирники", "golden Ukrainian syrniki cottage cheese pancakes on a plate"),
    "buckwheat-milk": ("Гречана каша з молоком", "a bowl of buckwheat porridge with milk and butter"),
    "avocado-egg-toast": ("Тост з авокадо та яйцем", "whole grain toast with smashed avocado and a boiled egg"),
    "greek-yogurt-berries": ("Грецький йогурт з ягодами", "greek yogurt in a bowl with fresh berries and granola"),
    "rice-apple-porridge": ("Рисова каша з яблуком", "creamy rice porridge with grated apple and cinnamon"),
    "borscht": ("Борщ", "a bowl of red Ukrainian borscht with sour cream"),
    "chicken-noodle-soup": ("Курячий суп з локшиною", "chicken noodle soup with carrot and potato in a bowl"),
    "buckwheat-chicken": ("Гречка з курячим філе", "buckwheat with pan-fried chicken fillet and onion on a plate"),
    "chicken-pilaf": ("Плов з куркою", "chicken pilaf with rice and carrots in a pan"),
    "pumpkin-soup": ("Крем-суп з гарбуза", "smooth orange pumpkin cream soup in a bowl"),
    "pasta-tomato": ("Макарони з томатним соусом", "pasta with tomato sauce and grated hard cheese"),
    "caesar-chicken": ("Салат Цезар з куркою", "chicken caesar salad with croutons and parmesan"),
    "braised-cabbage-pork": ("Тушкована капуста зі свининою", "braised cabbage with pork and carrot in a pan"),
    "baked-fish-vegetables": ("Запечена риба з овочами", "baked white fish fillet with zucchini and tomato, lemon"),
    "steamed-chicken-cutlets": ("Парові курячі котлети з броколі", "steamed chicken cutlets with broccoli on a plate"),
    "vegetable-stew": ("Овочеве рагу", "vegetable stew with zucchini, eggplant and potato"),
    "turkey-potatoes": ("Печена картопля з індичкою", "roasted potatoes with turkey fillet and paprika"),
    "stuffed-peppers": ("Фаршировані перці", "stuffed bell peppers in tomato sauce"),
    "lobio": ("Лобіо з червоної квасолі", "Georgian lobio red bean stew with walnuts and cilantro"),
    "tuna-egg-salad": ("Салат з тунцем та яйцем", "tuna salad with boiled egg, cucumber and lettuce"),
    "deruny": ("Деруни", "Ukrainian deruny potato pancakes on a plate"),
    "apple-peanut-butter": ("Яблуко з арахісовою пастою", "apple slices with peanut butter in a small bowl"),
    "cottage-cheese-honey": ("Сир кисломолочний з медом", "cottage cheese in a bowl drizzled with honey"),
    "hummus-carrots": ("Хумус з морквою", "hummus in a bowl with carrot sticks"),
    "banana-spinach-smoothie": ("Смузі з бананом і шпинатом", "green banana spinach smoothie in a glass"),
    "nuts-dried-fruits": ("Горіхи з сухофруктами", "mixed almonds, dried apricots and raisins in a bowl"),
    "baked-apples": ("Запечені яблука з корицею", "baked apples with cinnamon and honey"),
}


def generate(prompt: str, account: str, token: str) -> bytes:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{MODEL}"
    body = json.dumps({"prompt": f"{prompt}, {STYLE}", "steps": 6})
    proc = subprocess.run(
        ["curl", "-s", "-m", "120", "-X", "POST", url,
         "-H", f"Authorization: Bearer {token}", "-H", "Content-Type: application/json",
         "-d", body],
        capture_output=True, text=True,
    )
    data = json.loads(proc.stdout or "{}")
    if not data.get("success"):
        raise RuntimeError(json.dumps(data.get("errors") or data)[:300])
    return base64.b64decode(data["result"]["image"])


def main() -> None:
    dry = "--dry-run" in sys.argv
    account, token = os.environ.get("CF_ACCOUNT_ID"), os.environ.get("CF_API_TOKEN")
    if not dry and not (account and token):
        sys.exit("Set CF_ACCOUNT_ID and CF_API_TOKEN (or use --dry-run).")
    if not dry and not re.fullmatch(r"[0-9a-f]{32}", account):
        sys.exit(
            "CF_ACCOUNT_ID must be the 32-character hex Account ID from the Cloudflare "
            "dashboard, not a placeholder."
        )
    OUT.mkdir(exist_ok=True)
    failed = 0
    for slug, (name, prompt) in RECIPES.items():
        target = OUT / f"{slug}.jpg"
        if dry:
            print(f"{slug}: {prompt}, {STYLE}")
            continue
        if target.exists():
            print(f"skip   {slug}")
            continue
        try:
            target.write_bytes(generate(prompt, account, token))
            print(f"ok     {slug}  ({name})")
        except Exception as e:
            failed += 1
            print(f"FAILED {slug}: {e}")
            if failed == 1 and not any(OUT.glob("*.jpg")):
                sys.exit("\nThe very first request failed, so something is wrong with the "
                         "Account ID or the token. Fix it and run the script again.")
    if not dry:
        print(f"\nDone. {len(RECIPES) - failed}/{len(RECIPES)} images in {OUT}")


if __name__ == "__main__":
    main()
