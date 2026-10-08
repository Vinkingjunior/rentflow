import datetime as dt
from decimal import Decimal

from .models import Payment, Tenant
from .schemas import PaymentOut, TenantOut

ZERO = Decimal("0")


def months_due(t: Tenant, today: dt.date | None = None) -> int:
    """Number of rent due dates from the start month up to today (inclusive)."""
    today = today or dt.date.today()
    n = (today.year - t.start_date.year) * 12 + (today.month - t.start_date.month)
    if today.day >= t.due_day:
        n += 1
    return max(n, 0)


def total_paid(t: Tenant) -> Decimal:
    # Only confirmed payments count; a tenant-submitted "pending" payment does not reduce arrears
    return sum((p.amount for p in t.payments if p.status == "confirmed"), ZERO)


def arrears(t: Tenant, today: dt.date | None = None) -> Decimal:
    return max(months_due(t, today) * t.rent - total_paid(t), ZERO)


def status_for(t: Tenant, today: dt.date | None = None) -> str:
    owed = arrears(t, today)
    if owed == 0:
        return "current"
    if owed <= t.rent:
        return "late"
    return "delinquent"


def payment_out(p: Payment) -> PaymentOut:
    return PaymentOut(
        id=p.id, date=p.paid_on, amount=float(p.amount),
        method=p.method, note=p.note, status=p.status,
    )


def tenant_out(t: Tenant) -> TenantOut:
    return TenantOut(
        id=t.id, name=t.name, unit=t.unit, property=t.property,
        rent=float(t.rent), due_day=t.due_day, phone=t.phone, email=t.email,
        lease_end=t.lease_end, start_date=t.start_date,
        payments=[payment_out(p) for p in t.payments],
        total_paid=float(total_paid(t)), arrears=float(arrears(t)), status=status_for(t),
    )
