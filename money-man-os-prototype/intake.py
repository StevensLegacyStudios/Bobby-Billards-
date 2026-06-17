"""
Money Man OS - Intake layer (prototype).

Answers the question: "how does info get IN — do people fill out forms?"

No. The intended hierarchy, easiest first:
  1) Bank / card linking (auto, zero typing) - the eventual default.
  2) Document upload - snap or upload a bill / statement / payout; Money Man
     pulls the fields it needs and only asks follow-ups for what's missing.
  3) Conversational fallback - asks for the few fields it still can't get.

This module demonstrates tier (2) + (3) with a lightweight extractor standing in
for real OCR + an LLM. In production this step is an OCR/vision + LLM call; the
*shape* of the flow (extract -> detect missing -> ask only what's missing ->
map to engine objects) is exactly what ships.

Pure standard library.
"""

from __future__ import annotations

import re
from datetime import datetime, date

# Required fields per document type. If a required field can't be extracted,
# Money Man asks one targeted follow-up instead of making you fill a form.
REQUIRED = {
    "credit_card_statement": ["balance", "limit", "statement_close", "due_date",
                              "min_payment", "apr"],
    "utility_bill": ["amount", "due_date"],
    "phone_bill": ["amount", "due_date"],
    "gig_payout": ["amount", "deposit_date"],
}

FOLLOWUP = {
    "statement_close": "When does this card's statement close? (the date your "
                       "balance gets reported — usually ~3 weeks before the due "
                       "date). That date is how I lift your score.",
    "due_date": "What's the due date on this one?",
    "limit": "What's the credit limit on this card?",
    "apr": "What's the APR? (rough is fine)",
    "min_payment": "What's the minimum payment?",
    "amount": "What's the amount due?",
    "deposit_date": "What day did this hit your account?",
    "balance": "What's the current balance on the card?",
}


def _money(text, *patterns):
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            return float(m.group(1).replace(",", ""))
    return None


def _date(text, *patterns):
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
                try:
                    return datetime.strptime(m.group(1), fmt).date()
                except ValueError:
                    continue
    return None


def classify(text: str) -> str:
    t = text.lower()
    if "credit limit" in t or "apr" in t or "minimum payment" in t:
        return "credit_card_statement"
    if "doordash" in t or "1099" in t or "earnings" in t or "dasher" in t:
        return "gig_payout"
    if "t-mobile" in t or "verizon" in t or "at&t" in t or "wireless" in t:
        return "phone_bill"
    if "gas" in t or "electric" in t or "energy" in t or "water" in t:
        return "utility_bill"
    return "unknown"


def extract(text: str) -> tuple[str, dict]:
    """Stand-in for OCR + LLM extraction. Returns (doctype, fields)."""
    doctype = classify(text)
    f: dict = {}
    if doctype == "credit_card_statement":
        f["balance"] = _money(text, r"new balance:\s*\$?([\d,]+\.?\d*)")
        f["limit"] = _money(text, r"credit limit:\s*\$?([\d,]+\.?\d*)")
        f["min_payment"] = _money(text, r"minimum payment due:\s*\$?([\d,]+\.?\d*)")
        f["apr"] = _money(text, r"apr\)?:?\s*([\d.]+)\s*%")
        f["statement_close"] = _date(text, r"closing date:\s*([\d/]+)")
        f["due_date"] = _date(text, r"due date:\s*([\d/]+)")
        f["name"] = (re.search(r"(.+)\n", text).group(1).strip().title()
                     if re.search(r"(.+)\n", text) else "Credit Card")
    elif doctype in ("utility_bill", "phone_bill"):
        f["amount"] = _money(text, r"amount(?: due)?:\s*\$?([\d,]+\.?\d*)")
        f["due_date"] = _date(text, r"due date:\s*([\d/]+)")
        f["credit_impact"] = "not reported" not in text.lower()
        f["shutoff"] = "disconnect" in text.lower() or "shut" in text.lower()
        f["name"] = (re.search(r"(.+)\n", text).group(1).strip().title()
                     if re.search(r"(.+)\n", text) else "Bill")
    elif doctype == "gig_payout":
        f["amount"] = _money(text, r"total earnings:\s*\$?([\d,]+\.?\d*)")
        f["deposit_date"] = _date(text, r"deposit date:\s*([\d/]+)")
        f["is_1099"] = "1099" in text or "independent contractor" in text.lower()
        f["source"] = "DoorDash" if "doordash" in text.lower() else "Gig"
    return doctype, f


def missing_required(doctype: str, fields: dict) -> list:
    req = REQUIRED.get(doctype, [])
    return [k for k in req if fields.get(k) in (None, "")]


def followups(missing: list) -> list:
    return [FOLLOWUP.get(k, f"What's the {k.replace('_',' ')}?") for k in missing]
