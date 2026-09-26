from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RentFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or "*" for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)