import html
import re
import time

import httpx
from pydantic import BaseModel

OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl"
USER_AGENT = "Mealoria/0.1 (student project)"
CACHE_TTL = 24 * 3600

_cache: dict[str, tuple[float, list["FoodItem"]]] = {}


class FoodItem(BaseModel):
    name: str
    kcal_100g: float
    protein_100g: float
    fat_100g: float
    carbs_100g: float
    fiber_100g: float = 0


class FoodSearchError(Exception):
    pass


CYRILLIC = re.compile(r"[А-Яа-яІіЇїЄєҐґ]")
LATIN = re.compile(r"[A-Za-z]")
# Letters that do not exist in Ukrainian, and the standalone words "с" and "и"
# (Ukrainian says "з/із" and "і/й/та").
# Word endings that are typical for Russian adjectives and do not occur in Ukrainian ones
# ("ультрапастеризованное", "алтайская", "кисломолочный"); Ukrainian says -е, -а, -ий, -і.
RUSSIAN_ONLY = re.compile(
    r"[ыэёъЫЭЁЪ]"
    r"|(?<![А-Яа-яІіЇїЄєҐґ])[сСиИ](?![А-Яа-яІіЇїЄєҐґ])"
    r"|(?:ая|ое|ые|ый|ой|ие|ых|ую|яя|ее)(?![А-Яа-яІіЇїЄєҐґ])",
    re.IGNORECASE,
)


def is_ukrainian(name: str) -> bool:
    """Cyrillic, mostly not Latin, and without letters that do not exist in Ukrainian."""
    cyrillic, latin = len(CYRILLIC.findall(name)), len(LATIN.findall(name))
    return cyrillic > 0 and cyrillic >= latin and not RUSSIAN_ONLY.search(name)


def ukrainian_name(product: dict) -> str | None:
    """The explicit Ukrainian name; the default name only when Open Food Facts marks the entry as Ukrainian.

    Cyrillic alone is not enough: most Cyrillic entries are Russian, so a name without the "uk" mark is skipped.
    """
    name = html.unescape(product.get("product_name_uk") or "").strip()
    if name and is_ukrainian(name):
        return name
    if product.get("lang") == "uk":
        name = html.unescape(product.get("product_name") or "").strip()
        if name and is_ukrainian(name):
            return name
    return None


def parse_products(products: list[dict]) -> list[FoodItem]:
    """Keep products with a Ukrainian name and calories per 100 g; drop duplicate names."""
    seen, items = set(), []
    for p in products:
        n = p.get("nutriments") or {}
        name = ukrainian_name(p)
        kcal = n.get("energy-kcal_100g")
        if not name or kcal is None or name.lower() in seen:
            continue
        seen.add(name.lower())
        items.append(
            FoodItem(
                name=name,
                kcal_100g=kcal,
                protein_100g=n.get("proteins_100g") or 0,
                fat_100g=n.get("fat_100g") or 0,
                carbs_100g=n.get("carbohydrates_100g") or 0,
                fiber_100g=n.get("fiber_100g") or 0,
            )
        )
    return items


def search_food(query: str) -> list[FoodItem]:
    key = " ".join(query.lower().split())
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL:
        return cached[1]
    params = {
        "search_terms": key,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 60,  # many results are not Ukrainian, so ask for more and filter
        "fields": "product_name,product_name_uk,lang,nutriments",
    }
    for attempt in range(2):
        try:
            r = httpx.get(OFF_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
            r.raise_for_status()
            items = parse_products(r.json().get("products", []))[:10]
            break
        except (httpx.HTTPError, ValueError) as e:
            if attempt == 1:
                raise FoodSearchError(str(e)) from e
            time.sleep(1)
    _cache[key] = (time.time(), items)
    return items
