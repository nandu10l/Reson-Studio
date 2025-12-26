import os

APP_NAME = "Reson Studio API"
DB_URL = os.getenv("RESON_DB_URL", "sqlite:///./reson.db")
STORAGE_DIR = os.getenv("RESON_STORAGE_DIR", "./storage")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
