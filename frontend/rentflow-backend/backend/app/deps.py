import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Role, User
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        sub = decode_token(token).get("sub")
    except jwt.PyJWTError:
        raise invalid
    if not sub or not str(sub).isdigit():
        raise invalid
    user = db.get(User, int(sub))
    if user is None:
        raise invalid
    return user


def require_role(*roles: Role):
    """Role is checked against the database, not the token claim."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enough permissions")
        return user
    return checker
