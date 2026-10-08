"""Create dev data matching the frontend's sample tenants.  Run:  python seed.py"""
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app import models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.models import Payment, Role, Tenant, User
from app.security import hash_password

DEV_PASSWORD = "ChangeMe123!"   # development only

SAMPLE = [
    ("Amara Osei", "A-101", "Sunset Apartments", 45000, "+254 712 000 101", "amara@email.com", date(2026, 12, 31),
     [(date(2026, 5, 1), 45000, "Bank Transfer"), (date(2026, 4, 1), 45000, "Bank Transfer"), (date(2026, 3, 1), 22500, "Cash")]),
    ("Diego Reyes", "B-204", "Sunset Apartments", 38000, "+254 722 000 202", "diego@email.com", date(2027, 3, 31),
     [(date(2026, 4, 1), 38000, "Card"), (date(2026, 3, 1), 38000, "Card")]),
    ("Fatima Al-Hassan", "C-305", "Maple Grove", 60000, "+254 733 000 303", "fatima@email.com", date(2026, 9, 30),
     [(date(2026, 5, 1), 60000, "Bank Transfer"), (date(2026, 4, 1), 60000, "Bank Transfer"), (date(2026, 3, 1), 60000, "Bank Transfer")]),
    ("James Whitfield", "A-102", "Sunset Apartments", 42000, "+254 700 000 404", "james@email.com", date(2026, 7, 31),
     [(date(2026, 3, 1), 42000, "Cash")]),
]


def seed():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            print("Database already has users - skipping seed.")
            return

        db.add(User(email="landlord@rentflow.com", password_hash=hash_password(DEV_PASSWORD), role=Role.landlord))

        for name, unit, prop, rent, phone, email, lease_end, pays in SAMPLE:
            login = User(email=email, password_hash=hash_password(DEV_PASSWORD), role=Role.tenant)
            tenant = Tenant(
                user=login, name=name, unit=unit, property=prop, rent=Decimal(rent), due_day=1,
                phone=phone, email=email, lease_end=lease_end, start_date=date(2026, 1, 1),
            )
            tenant.payments = [
                Payment(amount=Decimal(a), method=m, paid_on=d, status="confirmed") for d, a, m in pays
            ]
            db.add(tenant)

        db.commit()
        print(f"Seeded. Log in as landlord@rentflow.com or amara@email.com with password: {DEV_PASSWORD}")


if __name__ == "__main__":
    seed()
