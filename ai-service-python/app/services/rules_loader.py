import json
from pathlib import Path
from app.core.config import RULES_PATH


def load_rules():
    path = Path(RULES_PATH)
    if not path.exists():
        raise FileNotFoundError(f"Rules file not found: {RULES_PATH}")

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("Rules file must be an array")

    return data
