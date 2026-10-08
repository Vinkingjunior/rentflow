from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginResponse, MeOut
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.strip().lower()))
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return LoginResponse(
        access_token=create_access_token(user.id, user.role.value),
        role=user.role.value,
        tenant_id=user.tenant.id if user.tenant else None,
    )


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(
        id=user.id, email=user.email, role=user.role.value,
        tenant_id=user.tenant.id if user.tenant else None,
    )
