import datetime as dt
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

PaymentMethod = Literal["Bank Transfer", "Cash", "Card", "Mobile Money", "Cheque"]


class CamelModel(BaseModel):
    """camelCase in/out so JSON matches the frontend (leaseEnd, dueDay, ...)."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
    )


# ── Auth (snake_case on purpose: the login form reads access_token / tenant_id) ──
class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    tenant_id: Optional[int] = None


class MeOut(BaseModel):
    id: int
    email: str
    role: str
    tenant_id: Optional[int] = None


# ── Payments ──
class PaymentCreate(CamelModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    method: PaymentMethod = "Bank Transfer"
    note: str = Field("", max_length=255)


class PaymentOut(CamelModel):
    id: int
    date: dt.date
    amount: float
    method: str
    note: str
    status: str


# ── Tenants ──
class TenantCreate(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    unit: str = Field(min_length=1, max_length=30)
    property: str = Field("", max_length=120)
    rent: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_day: int = Field(1, ge=1, le=28)
    phone: str = Field("", max_length=40)
    email: str = Field("", max_length=255)
    lease_end: Optional[dt.date] = None
    start_date: Optional[dt.date] = None
    # Optional: set to create a login for this tenant (needs an email too)
    password: Optional[str] = Field(None, min_length=8, max_length=72)


class TenantOut(CamelModel):
    id: int
    name: str
    unit: str
    property: str
    rent: float
    due_day: int
    phone: str
    email: str
    lease_end: Optional[dt.date]
    start_date: dt.date
    payments: list[PaymentOut]
    total_paid: float
    arrears: float
    status: Literal["current", "late", "delinquent"]
