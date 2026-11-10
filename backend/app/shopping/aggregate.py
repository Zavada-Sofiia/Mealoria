import re

AMOUNT = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(.*?)\s*$")


def norm(name: str) -> str:
    return " ".join(name.lower().split())


def _fmt(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def build_items(
    plan: list[dict], at_home: set[str], checked: set[str]
) -> tuple[list[dict], list[str]]:
    """Sum ingredients of all planned dishes into a shopping list.

    Amounts like "150 г" are summed per unit; anything else is listed as is.
    Products found in `at_home` are returned separately instead of in the list.
    """
    groups: dict[str, dict] = {}
    for entry in plan:
        for ing in (entry.get("dish") or {}).get("ingredients") or []:
            key = norm(ing["name"])
            if not key:
                continue
            g = groups.setdefault(key, {"name": ing["name"].strip(), "sums": {}, "other": {}})
            raw = (ing.get("amount") or "").strip()
            m = AMOUNT.match(raw)
            if m:
                unit = m.group(2).lower()
                g["sums"][unit] = g["sums"].get(unit, 0) + float(m.group(1).replace(",", "."))
            elif raw:
                g["other"][raw] = g["other"].get(raw, 0) + 1

    items, home = [], []
    for key, g in sorted(groups.items()):
        if key in at_home:
            home.append(g["name"])
            continue
        parts = [f"{_fmt(v)} {u}".strip() for u, v in g["sums"].items()]
        parts += [raw if n == 1 else f"{raw} ×{n}" for raw, n in g["other"].items()]
        items.append(
            {"name": g["name"], "amount": " + ".join(parts), "checked": key in checked}
        )
    return items, home
