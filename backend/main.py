from fastapi import FastAPI
from routers import users

app = FastAPI()

app.include_router(users.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Reson Studio API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)