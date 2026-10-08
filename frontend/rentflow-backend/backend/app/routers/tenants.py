from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Role, Tenant, User
from ..schemas import TenantCreate, TenantOut
from ..security import hash_password
from ..services import tenant_out

router = APIRouter(prefix="/tenants", tags=["tenants"])

landlord_only = require_role(Role.landlord)
tenant_only = require_role(Role.tenant)


@router.get("", response_model=list[TenantOut])
def list_tenants(db: Session = Depends(get_db), _: User = Depends(landlord_only)):
    tenants = db.scalars(
        select(Tenant).options(selectinload(Tenant.payments)).order_by(Tenant.id)
    ).all()
    return [tenant_out(t) for t in tenants]


# Declared before "/{tenant_id}" so "me" isn't parsed as an id
@router.get("/me", response_model=TenantOut)
def my_tenant_record(user: User = Depends(tenant_only)):
    if user.tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No tenant record linked to this account")
    return tenant_out(user.tenant)


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant = db.get(Tenant, tenant_id)
    not_yours = user.role == Role.tenant and (user.tenant is None or user.tenant.id != tenant_id)
    if tenant is None or not_yours:  # 404 either way so ids can't be probed
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    return tenant_out(tenant)


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _: User = Depends(landlord_only)):
    email = body.email.lower()
    login = None
    if body.password:
        if not email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "An email is required to create a login")
        if db.scalar(select(User).where(User.email == email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
        login = User(email=email, password_hash=hash_password(body.password), role=Role.tenant)

    tenant = Tenant(
        user=login,
        name=body.name, unit=body.unit, property=body.property, rent=body.rent,
        due_day=body.due_day, phone=body.phone, email=email,
        lease_end=body.lease_end,
        **({"start_date": body.start_date} if body.start_date else {}),
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant_out(tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: int, db: Session = Depends(get_db), _: User = Depends(landlord_only)):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    login = tenant.user
    db.delete(tenant)
    if login:
        db.delete(login)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
