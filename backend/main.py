from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import APP_NAME, ALLOWED_ORIGINS
from core.database import Base, engine
from core.storage import ensure_storage
from models.orm import UserORM, ProjectORM, TrackORM, AISuggestionORM  # registers tables

from routers import users, audio, projects, ai, render

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    ensure_storage()
    Base.metadata.create_all(bind=engine)

app.include_router(users.router)
app.include_router(audio.router)
app.include_router(projects.router)
app.include_router(ai.router)
app.include_router(render.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Reson Studio API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
