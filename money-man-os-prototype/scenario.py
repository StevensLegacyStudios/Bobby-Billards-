"""
Seed scenario for the prototype - the wedge user (the "messy-money operator"):
gig driving + a real trade business + irregular part-time, rebuilding credit,
1099 taxes. Numbers mirror the concept doc so the output is recognizable.

Dates are anchored to a fixed "today" so the demo is reproducible.
"""

from datetime import date
from liquidity_maximizer import Account, IncomeEvent, Bill, CreditCard

TODAY = date(2026, 6, 17)


def build():
    return build_tight()


def build_tight():
    account = Account(name="Checking", balance=640.0, buffer=200.0)

    incomes = [
        # Gig: variable, lower confidence, 1099.
        IncomeEvent(date(2026, 6, 18), 140.0, "DoorDash", 0.60, is_1099=True),
        IncomeEvent(date(2026, 6, 25), 160.0, "DoorDash", 0.55, is_1099=True),
        IncomeEvent(date(2026, 7, 2), 150.0, "DoorDash", 0.55, is_1099=True),
        # Trade business: a booked plumbing job, fairly likely, 1099.
        IncomeEvent(date(2026, 6, 23), 480.0, "Plumb Bob job", 0.85, is_1099=True),
        # Part-time W-2: confirmed direct deposit.
        IncomeEvent(date(2026, 6, 20), 300.0, "Part-time payroll", 0.97),
        IncomeEvent(date(2026, 7, 3), 300.0, "Part-time payroll", 0.97),
    ]

    bills = [
        Bill("Rent", 1200.0, date(2026, 7, 1), credit_impact=False, kind="rent",
             late_fee=75.0),
        Bill("Car insurance", 140.0, date(2026, 6, 26), credit_impact=False,
             kind="insurance", shutoff_or_lapse=True),
        Bill("PG&E electric", 120.0, date(2026, 6, 24), credit_impact=False,
             kind="utility", shutoff_or_lapse=True),
        Bill("Phone", 85.0, date(2026, 6, 30), credit_impact=False, kind="phone"),
        Bill("Auto loan", 310.0, date(2026, 7, 5), credit_impact=True, kind="loan",
             late_fee=29.0),
    ]

    cards = [
        CreditCard("Apex Visa", balance=710.0, limit=1000.0,
                   statement_close=date(2026, 6, 28), due_date=date(2026, 7, 15),
                   apr=29.99, min_payment=35.0),
        CreditCard("Summit Card", balance=300.0, limit=500.0,
                   statement_close=date(2026, 7, 2), due_date=date(2026, 7, 20),
                   apr=26.99, min_payment=25.0),
    ]

    return account, incomes, bills, cards


def build_good():
    """Same user, a stronger week (just got paid + a booked plumbing job).
    Now there's real cash flow, so the credit-timing move actually fires."""
    account, _incomes, bills, cards = build_tight()
    account.balance = 1900.0
    incomes = [
        IncomeEvent(date(2026, 6, 18), 165.0, "DoorDash", 0.60, is_1099=True),
        IncomeEvent(date(2026, 6, 25), 150.0, "DoorDash", 0.55, is_1099=True),
        IncomeEvent(date(2026, 6, 20), 300.0, "Part-time payroll", 0.97),
        IncomeEvent(date(2026, 7, 3), 300.0, "Part-time payroll", 0.97),
        # A solid, booked plumbing job clears mid-week (confirmed).
        IncomeEvent(date(2026, 6, 23), 480.0, "Plumb Bob job", 0.90, is_1099=True),
    ]
    return account, incomes, bills, cards
