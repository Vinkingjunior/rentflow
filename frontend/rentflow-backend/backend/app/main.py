from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import settings
from .database import Base, engine
from .routers import auth, payments, tenants


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # swap for Alembic migrations once the schema settles
    yield


app = FastAPI(title="RentFlow API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(payments.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
