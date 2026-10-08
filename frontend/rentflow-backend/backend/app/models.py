import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    landlord = "landlord"
    tenant = "tenant"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(SAEnum(Role, name="role"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="user", uselist=False)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(30))
    property: Mapped[str] = mapped_column(String(120), default="")
    rent: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    due_day: Mapped[int] = mapped_column(Integer, default=1)
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    lease_end: Mapped[Optional[date]] = mapped_column(Date)
    start_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional[User]] = relationship(back_populates="tenant")
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="tenant",
        cascade="all, delete-orphan",
        order_by="Payment.paid_on.desc(), Payment.id.desc()",
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(40))
    note: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # confirmed | pending
    paid_on: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Tenant] = relationship(back_populates="payments")
