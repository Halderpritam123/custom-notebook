"""
main.py — FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.database import create_all_tables
from app.routers import auth, topics, categories

app = FastAPI(title="AI Notebook")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    create_all_tables()


app.include_router(auth.router)
app.include_router(topics.router)
app.include_router(categories.router)
