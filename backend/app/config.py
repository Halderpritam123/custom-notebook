"""
config.py — centralised environment variable loading.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///:memory:")
JWT_SECRET: str = os.getenv("JWT_SECRET", "fallback-secret-change-in-production")

LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o")
LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://models.inference.ai.azure.com")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
REGISTRATION_OPEN: bool = os.getenv("REGISTRATION_OPEN", "true").lower() == "true"

GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")