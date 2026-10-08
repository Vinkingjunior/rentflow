from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Payment, Role, Tenant, User
from ..schemas import PaymentCreate, PaymentOut
from ..services import payment_out

router = APIRouter(prefix="/tenants/{tenant_id}/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    tenant_id: int,
    body: PaymentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, tenant_id)
    not_yours = user.role == Role.tenant and (user.tenant is None or user.tenant.id != tenant_id)
    if tenant is None or not_yours:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")

    # Landlord-recorded payments are confirmed; tenant-submitted ones wait for the landlord
    # so a tenant can't clear their own arrears by posting fake payments.
    payment = Payment(
        tenant_id=tenant.id,
        amount=body.amount,
        method=body.method,
        note=body.note,
        status="confirmed" if user.role == Role.landlord else "pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment_out(payment)


@router.post("/{payment_id}/confirm", response_model=PaymentOut)
def confirm_payment(
    tenant_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.landlord)),
):
    payment = db.get(Payment, payment_id)
    if payment is None or payment.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    payment.status = "confirmed"
    db.commit()
    return payment_out(payment)
