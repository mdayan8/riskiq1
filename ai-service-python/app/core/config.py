import os
from dotenv import load_dotenv

load_dotenv()

required = [
    "PORT",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "DEEPSEEK_MODEL",
    "RULES_PATH",
    "REPORTS_DIR",
]

missing = [key for key in required if not os.getenv(key)]
if missing:
    raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")

PORT = int(os.getenv("PORT", "8000"))
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL")
RULES_PATH = os.getenv("RULES_PATH")
REPORTS_DIR = os.getenv("REPORTS_DIR")
