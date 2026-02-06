from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import users, audio, effects, audiopack, midi

app = FastAPI()

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(audio.router)
app.include_router(effects.router)
app.include_router(audiopack.router)
app.include_router(midi.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Reson Studio API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)