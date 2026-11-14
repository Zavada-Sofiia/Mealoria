import re

AMOUNT = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(.*?)\s*$")


def norm(name: str) -> str:
    return " ".join(name.lower().split())


# the same product written in another form is one line in the list
SAME_PRODUCT = {
    "яйця": "яйце", "яйця курячі": "яйце", "яйце куряче": "яйце", "куряче яйце": "яйце", "курячі яйця": "яйце",
    "яблука": "яблуко", "банани": "банан", "груші": "груша", "апельсини": "апельсин", "лимони": "лимон",
    "помідори": "помідор", "томати": "помідор", "томат": "помідор", "огірки": "огірок", 
    "цибуля ріпчаста": "цибуля", "ріпчаста цибуля": "цибуля", "цибулина": "цибуля",
    "картошка": "картопля", "перець болгарський": "болгарський перець",
    "капуста броколі": "броколі", "гриби печериці": "печериці", "шампіньйони": "печериці",
    "масло вершкове": "вершкове масло", "масло оливкове": "оливкова олія", "олія оливкова": "оливкова олія",
    "олія соняшникова": "соняшникова олія", 
    "сир твердий": "твердий сир",
    "куряча грудка": "куряче філе", "філе курки": "куряче філе",
    "яловичина пісна": "яловичина", "свинина пісна": "свинина",
}

UNIT_FORMS = {
    "г": ("г", 1), "гр": ("г", 1), "грам": ("г", 1), "грами": ("г", 1), "кг": ("г", 1000),
    "мл": ("мл", 1), "л": ("мл", 1000), "літр": ("мл", 1000), "літри": ("мл", 1000),
    "шт": ("шт", 1), "шт.": ("шт", 1), "штука": ("шт", 1), "штуки": ("шт", 1),
    "зубчик": ("зубчик", 1), "зубчики": ("зубчик", 1), "зубчиків": ("зубчик", 1),
    "скибка": ("скибка", 1), "скибки": ("скибка", 1), "скибок": ("скибка", 1),
    "ст. л.": ("ст. л.", 1), "ст.л.": ("ст. л.", 1), "ч. л.": ("ч. л.", 1), "ч.л.": ("ч. л.", 1),
}


def product_key(name: str) -> str:
    """Same key for "Яблука" and "яблуко", or "Вершкове масло (82%)" and "масло вершкове"."""
    plain = norm(re.sub(r"\([^)]*\)", " ", name))
    return SAME_PRODUCT.get(plain, plain)


def _unit(unit: str, value: float) -> tuple[str, float]:
    canonical, factor = UNIT_FORMS.get(unit.strip().lower(), (unit.strip().lower(), 1))
    return canonical, value * factor


COUNTABLE = {"зубчик": ("зубчик", "зубчики", "зубчиків"), "скибка": ("скибка", "скибки", "скибок")}


def _amount_text(unit: str, value: float) -> str:
    if unit in COUNTABLE:
        n = int(round(value))
        one, few, many = COUNTABLE[unit]
        if value != n:
            unit = few
        else:
            unit = one if n % 10 == 1 and n % 100 != 11 else few if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else many
    # 1500 г reads better as 1.5 кг
    if unit in ("г", "мл") and value >= 1000:
        return f"{_fmt(value / 1000)} {'кг' if unit == 'г' else 'л'}"
    return f"{_fmt(value)} {unit}".strip()


def _fmt(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def build_items(
    plan: list[dict], at_home: set[str], checked: set[str]
) -> tuple[list[dict], list[str]]:
    """Sum ingredients of all planned dishes into a shopping list.

    Amounts like "150 г" are summed per unit; anything else is listed as is.
    A dish's ingredients are for the whole dish (for example a pot of 6 servings) and every planned
    entry is one serving, so each entry adds 1/servings of the amounts.
    Products found in `at_home` are returned separately instead of in the list.
    """
    groups: dict[str, dict] = {}
    at_home = {product_key(n) for n in at_home} | at_home
    checked = {product_key(n) for n in checked} | checked
    for entry in plan:
        dish = entry.get("dish") or {}
        share = 1 / max(1, int(dish.get("servings") or 1))
        for ing in dish.get("ingredients") or []:
            key = product_key(ing["name"])
            if not key:
                continue
            g = groups.setdefault(key, {"name": ing["name"].strip(), "sums": {}, "other": {}})
            raw = (ing.get("amount") or "").strip()
            m = AMOUNT.match(raw)
            if m:
                unit, value = _unit(m.group(2), float(m.group(1).replace(",", ".")))
                g["sums"][unit] = g["sums"].get(unit, 0) + value * share
            elif raw:
                g["other"][raw] = g["other"].get(raw, 0) + share

    items, home = [], []
    for key, g in sorted(groups.items()):
        if key in at_home:
            home.append(g["name"])
            continue
        parts = [_amount_text(u, v) for u, v in g["sums"].items()]
        parts += [raw if n < 1.5 else f"{raw} ×{round(n)}" for raw, n in g["other"].items()]
        items.append(
            {"name": g["name"], "amount": " + ".join(parts), "checked": key in checked}
        )
    return items, home
