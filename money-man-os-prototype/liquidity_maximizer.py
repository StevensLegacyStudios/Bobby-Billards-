"""
Money Man OS - Liquidity Maximizer engine (prototype).

The one mechanic no consumer finance app has: given irregular, multi-stream
income + bills + credit cards, compute the EXACT day to pay each thing so the
user keeps the most cash on hand AND lifts their credit score, without ever
tripping an overdraft or a late fee.

Pure Python 3 standard library. No dependencies.

Core ideas:
  - Hold no-credit-impact bills as late as safely possible (preserve float).
  - Pay credit cards BEFORE statement close to report low utilization, but only
    with cash that doesn't threaten the safety buffer.
  - Treat variable income as events with a confidence; plan conservatively on
    confirmed ("safe") income, and surface "you need $X by <day>" when there's
    a gap. (This is the part Rocket Money's safe-to-spend can't do.)
  - Check every day with worst-case intraday ordering (bills post before income)
    so an overdraft can't hide.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Callable, Optional

# Days of slack we leave for a payment to post before a deadline matters.
PROCESSING_BUFFER_DAYS = 2
# Confidence at/above which we treat an income event as "money in the bank".
SAFE_CONFIDENCE = 0.8
# Fraction of 1099 / gig income to park for taxes.
TAX_SET_ASIDE_RATE = 0.25
# Utilization thresholds that matter to scoring.
UTIL_GREAT = 0.09
UTIL_GOOD = 0.29
# Keep this much cash liquid (above the buffer) before chasing the last few
# utilization points - the whole point is to maximize money on hand.
LIQUIDITY_CUSHION = 150.0
# Don't bother spending cash on a paydown that barely moves the needle.
MIN_MEANINGFUL_PAYDOWN = 20.0


# --------------------------------------------------------------------------- #
# Domain model
# --------------------------------------------------------------------------- #
@dataclass
class Account:
    name: str
    balance: float
    buffer: float  # the floor the user never wants to drop below


@dataclass
class IncomeEvent:
    date: date
    amount: float
    source: str
    confidence: float           # 0..1 ; gig income is low, payroll is high
    is_1099: bool = False       # gig / self-employed -> needs tax set-aside


@dataclass
class Bill:
    name: str
    amount: float
    due_date: date
    credit_impact: bool         # does a late payment hit the credit report?
    late_fee: float = 0.0
    kind: str = "bill"          # rent | utility | insurance | loan | phone ...
    shutoff_or_lapse: bool = False  # utility shutoff / insurance lapse risk
    earliest_pay: Optional[date] = None
    flexible: bool = True       # can we choose the date? (fixed autopay = False)


@dataclass
class CreditCard:
    name: str
    balance: float
    limit: float
    statement_close: date       # the day the balance is reported to bureaus
    due_date: date
    apr: float
    min_payment: float

    @property
    def utilization(self) -> float:
        return self.balance / self.limit if self.limit else 0.0


@dataclass
class Payment:
    date: date
    amount: float
    label: str
    reason: str
    kind: str
    credit_impact: bool = False
    util_before: Optional[float] = None
    util_after: Optional[float] = None


@dataclass
class Plan:
    today: date
    horizon: date
    account: Account
    payments: list
    incomes: list
    bills: list
    cards: list
    safe_to_spend: float
    runway_days: Optional[int]
    min_low_safe: float
    min_low_safe_date: date
    alerts: list
    notes: list
    tax_set_aside: float
    tax_notes: list
    series_safe: list
    series_expected: list


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def fmt_day(d: date) -> str:
    return d.strftime("%a %-m/%-d") if hasattr(d, "strftime") else str(d)


def money(x: float) -> str:
    return f"${x:,.0f}"


def is_safe(e: IncomeEvent) -> bool:
    return e.confidence >= SAFE_CONFIDENCE


def simulate(start_balance: float, today: date, horizon: date,
             incomes: list, payments: list,
             income_filter: Callable[[IncomeEvent], bool]):
    """Day-by-day projection. Worst-case intraday ordering: outflows post before
    inflows, so the 'low' for the day is the true risk point an overdraft hides
    behind. Returns (series, min_low, min_low_date)."""
    inflow = defaultdict(float)
    for e in incomes:
        if income_filter(e) and today <= e.date <= horizon:
            inflow[e.date] += e.amount
    outflow = defaultdict(float)
    for p in payments:
        if today <= p.date <= horizon:
            outflow[p.date] += p.amount

    series = []
    bal = start_balance
    min_low = start_balance
    min_low_date = today
    for d in daterange(today, horizon):
        low = bal - outflow[d]        # worst case: pay before you get paid
        bal = low + inflow[d]
        series.append((d, bal, low))
        if low < min_low:
            min_low, min_low_date = low, d
    return series, min_low, min_low_date


# --------------------------------------------------------------------------- #
# The optimizer
# --------------------------------------------------------------------------- #
def build_plan(account: Account, incomes: list, bills: list, cards: list,
               today: date, horizon_days: int = 35) -> Plan:
    horizon = today + timedelta(days=horizon_days)
    payments: list = []
    notes: list = []

    # 1) Bills: pay as LATE as safely possible to preserve cash on hand.
    for b in bills:
        earliest = b.earliest_pay or today
        latest_safe = b.due_date - timedelta(days=PROCESSING_BUFFER_DAYS)
        pay_date = max(earliest, latest_safe, today)
        if not b.flexible:
            pay_date = b.due_date  # fixed autopay; we don't get to choose
        if b.credit_impact:
            reason = (f"Protects your credit: a late {b.kind} payment reports to "
                      f"the bureaus. Paid {PROCESSING_BUFFER_DAYS}d before the "
                      f"{fmt_day(b.due_date)} due date, not early — keep the cash.")
        elif b.shutoff_or_lapse:
            risk = "lapse" if b.kind == "insurance" else "shut-off"
            reason = (f"No credit impact, but {risk} risk. Held until just before "
                      f"{fmt_day(b.due_date)} to keep cash on hand, then paid.")
        else:
            reason = (f"No credit impact. Held as late as safe (just before "
                      f"{fmt_day(b.due_date)}) so the money stays in your pocket "
                      f"as long as possible.")
        payments.append(Payment(pay_date, b.amount, b.name, reason, b.kind,
                                credit_impact=b.credit_impact))

    # 2) Credit cards, highest utilization first: pay down BEFORE statement close
    #    using only cash that keeps the buffer safe. Preserve float beyond what's
    #    needed to reach a great utilization number.
    card_results = {}
    for c in sorted(cards, key=lambda c: c.utilization, reverse=True):
        if c.statement_close < today:
            notes.append(f"{c.name}: statement already closed this cycle — "
                         f"target the next close date instead.")
            card_results[c.name] = (c.utilization, c.utilization, 0.0)
            continue
        target = max(today, c.statement_close - timedelta(days=PROCESSING_BUFFER_DAYS))

        # Headroom = how much we can pay on `target` without any later day's
        # worst-case balance dropping below the buffer, on SAFE income only.
        series, _, _ = simulate(account.balance, today, horizon, incomes,
                                payments, is_safe)
        fwd_lows = [low for (d, _bal, low) in series if d >= target]
        headroom = max(0.0, (min(fwd_lows) if fwd_lows else 0.0) - account.buffer)

        # Target the 30% line lenders watch first; only chase the under-10%
        # sweet spot if there's still a healthy cash cushion left afterward.
        pd_good = max(0.0, c.balance - UTIL_GOOD * c.limit)
        pd_great = max(0.0, c.balance - UTIL_GREAT * c.limit)
        if headroom >= pd_great + LIQUIDITY_CUSHION:
            extra = pd_great
        elif headroom >= pd_good:
            extra = pd_good
        else:
            extra = headroom
        extra = round(min(extra, c.balance), 2)
        meaningful = (extra >= MIN_MEANINGFUL_PAYDOWN
                      and (c.utilization - (c.balance - extra) / c.limit) >= 0.02)

        if extra <= 0 or not meaningful:
            notes.append(
                f"{c.name}: no spare cash before it reports on "
                f"{fmt_day(c.statement_close)} without risking your "
                f"{money(account.buffer)} buffer. Utilization stays "
                f"{c.utilization:.0%}. Biggest lever here is more income first.")
            card_results[c.name] = (c.utilization, c.utilization, 0.0)
            # still protect history with the minimum by the due date
            payments.append(Payment(
                max(today, c.due_date - timedelta(days=PROCESSING_BUFFER_DAYS)),
                c.min_payment, f"{c.name} — minimum",
                "Protects payment history (the biggest credit factor). Minimum "
                f"only, by {fmt_day(c.due_date)} — cash is too tight to do more.",
                "credit_card", credit_impact=True))
            continue

        new_util = (c.balance - extra) / c.limit
        crossed = ""
        if c.utilization > UTIL_GOOD >= new_util:
            crossed = " — crosses under the 30% line that lenders watch"
        if new_util <= UTIL_GREAT:
            crossed = " — lands in the under-10% sweet spot"
        reason = (f"Pay {money(extra)} before it reports on "
                  f"{fmt_day(c.statement_close)} so utilization drops "
                  f"{c.utilization:.0%} → {new_util:.0%}{crossed}. Paid only "
                  f"what keeps your {money(account.buffer)} buffer safe — the rest "
                  f"of your cash stays liquid.")
        pay = Payment(target, extra, f"{c.name} — paydown", reason, "credit_card",
                      credit_impact=True, util_before=c.utilization,
                      util_after=new_util)
        payments.append(pay)
        card_results[c.name] = (c.utilization, new_util, extra)

        # Top up to the minimum by the due date if the paydown didn't cover it.
        if extra < c.min_payment:
            payments.append(Payment(
                max(today, c.due_date - timedelta(days=PROCESSING_BUFFER_DAYS)),
                round(c.min_payment - extra, 2), f"{c.name} — minimum top-up",
                f"Tops the paydown up to the {money(c.min_payment)} minimum by "
                f"{fmt_day(c.due_date)} to protect payment history.",
                "credit_card", credit_impact=True))

    # 3) Final safety pass on confirmed (safe) income.
    series_safe, min_low_safe, min_low_safe_date = simulate(
        account.balance, today, horizon, incomes, payments, is_safe)
    series_expected, _, _ = simulate(
        account.balance, today, horizon, incomes, payments, lambda e: True)

    safe_to_spend = max(0.0, min_low_safe - account.buffer)

    runway = None
    for (d, _bal, low) in series_safe:
        if low < account.buffer:
            runway = (d - today).days
            break

    # 4) Alerts + required income when confirmed money isn't enough.
    alerts = []
    if min_low_safe < account.buffer:
        shortfall = account.buffer - min_low_safe
        # does expected (unconfirmed) income close the gap by that date?
        exp_low_by_date = min(
            (low for (d, _b, low) in series_expected if d <= min_low_safe_date),
            default=min_low_safe)
        if exp_low_by_date >= account.buffer:
            alerts.append(
                f"TIGHT: by {fmt_day(min_low_safe_date)} you dip "
                f"{money(account.buffer - min_low_safe)} under your buffer on "
                f"CONFIRMED money. Expected gig/job income covers it — but it's "
                f"not guaranteed. Earn {money(shortfall)} before then to be safe.")
        else:
            alerts.append(
                f"AT RISK: you need about {money(shortfall)} more by "
                f"{fmt_day(min_low_safe_date)} or you break your "
                f"{money(account.buffer)} buffer — even counting expected income. "
                f"This is the number to drive to.")

    # 5) Tax set-aside on 1099 / gig income in the window.
    tax_notes = []
    tax_total = 0.0
    for e in incomes:
        if e.is_1099 and today <= e.date <= horizon:
            setaside = round(e.amount * TAX_SET_ASIDE_RATE, 2)
            tax_total += setaside
            tax_notes.append(
                f"{fmt_day(e.date)}: {e.source} {money(e.amount)} (1099) — set "
                f"aside {money(setaside)} for taxes.")
    tax_total = round(tax_total, 2)

    payments.sort(key=lambda p: p.date)
    return Plan(today, horizon, account, payments, incomes, bills, cards,
                round(safe_to_spend, 2), runway, round(min_low_safe, 2),
                min_low_safe_date, alerts, notes, tax_total, tax_notes,
                series_safe, series_expected)


# --------------------------------------------------------------------------- #
# Console report (the blunt "Money Man" voice)
# --------------------------------------------------------------------------- #
def render_console(plan: Plan) -> str:
    L = []
    A = L.append
    bar = "=" * 64
    A(bar)
    A("  MONEY MAN OS  ·  Liquidity Maximizer")
    A(f"  {fmt_day(plan.today)}  ·  next {(plan.horizon - plan.today).days} days")
    A(bar)

    # Headline: am I safe?
    if not plan.alerts and plan.runway_days is None:
        A("  STATUS: SAFE. Bills are covered on confirmed money for the whole window.")
    elif plan.runway_days is None:
        A("  STATUS: OK, with a tight spot flagged below.")
    else:
        A(f"  STATUS: AT RISK. Confirmed cash runs the buffer dry in "
          f"{plan.runway_days} days.")
    A(f"  Safe-to-spend right now: {money(plan.safe_to_spend)}  "
      f"(above your {money(plan.account.buffer)} buffer, after every scheduled bill)")
    A(f"  Lowest confirmed balance ahead: {money(plan.min_low_safe)} on "
      f"{fmt_day(plan.min_low_safe_date)}")
    A("")

    if plan.alerts:
        A("  -- DANGER --------------------------------------------------")
        for a in plan.alerts:
            A(f"  ! {a}")
        A("")

    # The schedule
    A("  -- PAYMENT SCHEDULE (the exact days) ------------------------")
    for p in plan.payments:
        tag = "credit" if p.credit_impact else "      "
        A(f"  {fmt_day(p.date):<10} {money(p.amount):>8}  {p.label}")
        A(f"             {p.reason}")
    A("")

    # Credit moves
    moved = [p for p in plan.payments if p.util_after is not None]
    if moved:
        A("  -- CREDIT: REPORTED UTILIZATION ----------------------------")
        for p in moved:
            A(f"  {p.label.split(' —')[0]:<16} "
              f"{p.util_before:.0%}  ->  {p.util_after:.0%}")
        A("")

    # Taxes
    if plan.tax_notes:
        A("  -- TAXES (1099 set-aside) ----------------------------------")
        for n in plan.tax_notes:
            A(f"  · {n}")
        A(f"  Total to park for taxes this window: {money(plan.tax_set_aside)}")
        A("")

    # Notes
    if plan.notes:
        A("  -- NOTES ----------------------------------------------------")
        for n in plan.notes:
            A(f"  · {n}")
        A("")

    A(bar)
    A("  Money Man recommends; it never moves a dollar without your say-so.")
    A(bar)
    return "\n".join(L)


# --------------------------------------------------------------------------- #
# Self-contained HTML report (the "see money moving through time" view)
# --------------------------------------------------------------------------- #
def render_html(plan: Plan) -> str:
    W, H = 900, 320
    pad_l, pad_r, pad_t, pad_b = 50, 20, 20, 30
    series_e = plan.series_expected
    series_s = plan.series_safe
    lows_e = [low for (_d, _b, low) in series_e]
    bals_e = [bal for (_d, bal, _l) in series_e]
    vals = lows_e + bals_e + [b for (_d, b, _l) in series_s] + [plan.account.buffer, 0]
    vmin, vmax = min(vals), max(vals)
    if vmax == vmin:
        vmax = vmin + 1
    n = len(series_e)

    def x(i):
        return pad_l + (W - pad_l - pad_r) * (i / max(1, n - 1))

    def y(v):
        return pad_t + (H - pad_t - pad_b) * (1 - (v - vmin) / (vmax - vmin))

    def path(series, key):
        pts = []
        for i, row in enumerate(series):
            v = row[2] if key == "low" else row[1]
            pts.append(f"{x(i):.1f},{y(v):.1f}")
        return "M" + " L".join(pts)

    buf_y = y(plan.account.buffer)
    zero_y = y(0)
    danger_rect = (f'<rect x="{pad_l}" y="{buf_y:.1f}" width="{W-pad_l-pad_r}" '
                   f'height="{max(0, zero_y-buf_y):.1f}" fill="#ff3b3b" '
                   f'opacity="0.10"/>')

    # income (green) and bill (red) markers along the axis
    markers = []
    bill_days = {p.date: p for p in plan.payments}
    for i, (d, _b, _l) in enumerate(series_e):
        for e in plan.incomes:
            if e.date == d:
                markers.append(
                    f'<circle cx="{x(i):.1f}" cy="{y(_b):.1f}" r="4" '
                    f'fill="#2ecc71"><title>{e.source} +{money(e.amount)} '
                    f'(conf {e.confidence:.0%})</title></circle>')
        if d in bill_days:
            markers.append(
                f'<circle cx="{x(i):.1f}" cy="{buf_y-0:.1f}" r="0"/>')

    buffer_line = (f'<line x1="{pad_l}" y1="{buf_y:.1f}" x2="{W-pad_r}" '
                   f'y2="{buf_y:.1f}" stroke="#ffcc00" stroke-dasharray="5,4" '
                   f'stroke-width="1.5"/>'
                   f'<text x="{pad_l+4}" y="{buf_y-5:.1f}" fill="#ffcc00" '
                   f'font-size="11">buffer {money(plan.account.buffer)}</text>')

    # recommendation cards
    cards_html = []
    for p in plan.payments:
        col = "#ff6b6b" if p.credit_impact else "#7aa2ff"
        cards_html.append(
            f'<div class="card"><div class="row"><span class="day">'
            f'{fmt_day(p.date)}</span><span class="amt">{money(p.amount)}</span>'
            f'</div><div class="lbl" style="color:{col}">{p.label}</div>'
            f'<div class="why">{p.reason}</div></div>')

    util_html = []
    for p in plan.payments:
        if p.util_after is not None:
            wb = int(p.util_before * 100)
            wa = int(p.util_after * 100)
            util_html.append(
                f'<div class="util"><div class="uname">{p.label.split(" —")[0]}'
                f'</div><div class="bars"><div class="bar"><i style="width:{wb}%;'
                f'background:#ff6b6b"></i><b>{wb}%</b></div><div class="bar">'
                f'<i style="width:{wa}%;background:#2ecc71"></i><b>{wa}%</b></div>'
                f'</div></div>')

    alerts_html = "".join(f'<div class="alert">⚠ {a}</div>' for a in plan.alerts)
    tax_html = ""
    if plan.tax_notes:
        items = "".join(f"<li>{n}</li>" for n in plan.tax_notes)
        tax_html = (f'<div class="block"><h3>Taxes — set aside '
                    f'{money(plan.tax_set_aside)}</h3><ul>{items}</ul></div>')

    status = ("SAFE" if (not plan.alerts and plan.runway_days is None)
              else ("AT RISK" if plan.runway_days is not None else "TIGHT"))
    status_col = {"SAFE": "#2ecc71", "TIGHT": "#ffcc00", "AT RISK": "#ff6b6b"}[status]

    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Money Man OS — Liquidity Maximizer</title>
<style>
  body{{margin:0;background:#0b0e14;color:#e6e9ef;font:14px/1.5 -apple-system,
       Segoe UI,Roboto,Helvetica,Arial,sans-serif}}
  .wrap{{max-width:940px;margin:0 auto;padding:24px}}
  h1{{font-size:20px;margin:0 0 2px}} .sub{{color:#8a93a6;margin-bottom:16px}}
  .status{{display:inline-block;padding:4px 12px;border-radius:999px;
          font-weight:700;color:#0b0e14;background:{status_col}}}
  .metrics{{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0}}
  .metric{{background:#141925;border:1px solid #222a3a;border-radius:12px;
          padding:12px 16px;flex:1;min-width:160px}}
  .metric .v{{font-size:22px;font-weight:700}} .metric .k{{color:#8a93a6;font-size:12px}}
  .chart{{background:#141925;border:1px solid #222a3a;border-radius:12px;
         padding:8px;margin:8px 0 20px}}
  .grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
  .card{{background:#141925;border:1px solid #222a3a;border-radius:12px;padding:12px}}
  .card .row{{display:flex;justify-content:space-between;font-weight:700}}
  .card .day{{color:#8a93a6}} .card .amt{{font-size:16px}}
  .card .lbl{{font-weight:700;margin:2px 0 4px}} .card .why{{color:#aeb6c6;font-size:13px}}
  .alert{{background:#2a1414;border:1px solid #5a2a2a;color:#ffb3b3;
         padding:10px 14px;border-radius:10px;margin:6px 0}}
  .block{{background:#141925;border:1px solid #222a3a;border-radius:12px;
         padding:12px 16px;margin:16px 0}}
  h3{{margin:0 0 8px;font-size:15px}}
  .util{{margin:8px 0}} .uname{{font-size:13px;color:#aeb6c6;margin-bottom:4px}}
  .bars{{display:flex;flex-direction:column;gap:4px}}
  .bar{{position:relative;background:#0b0e14;border-radius:6px;height:18px}}
  .bar i{{position:absolute;left:0;top:0;bottom:0;border-radius:6px;display:block}}
  .bar b{{position:absolute;right:6px;top:0;font-size:11px;line-height:18px}}
  h2{{font-size:15px;color:#8a93a6;margin:20px 0 8px;text-transform:uppercase;
     letter-spacing:.5px}}
</style></head><body><div class="wrap">
  <h1>Money Man OS — Liquidity Maximizer</h1>
  <div class="sub">{fmt_day(plan.today)} · next {(plan.horizon-plan.today).days} days ·
     <span class="status">{status}</span></div>
  <div class="metrics">
    <div class="metric"><div class="v">{money(plan.safe_to_spend)}</div>
       <div class="k">safe to spend now</div></div>
    <div class="metric"><div class="v">{('—' if plan.runway_days is None else str(plan.runway_days)+'d')}</div>
       <div class="k">confirmed cash runway</div></div>
    <div class="metric"><div class="v">{money(plan.min_low_safe)}</div>
       <div class="k">lowest point · {fmt_day(plan.min_low_safe_date)}</div></div>
    <div class="metric"><div class="v">{money(plan.tax_set_aside)}</div>
       <div class="k">park for taxes</div></div>
  </div>
  {alerts_html}
  <div class="chart"><svg viewBox="0 0 {W} {H}" width="100%">
    {danger_rect}
    <path d="{path(series_e,'bal')}" fill="none" stroke="#7aa2ff" stroke-width="2"/>
    <path d="{path(series_s,'low')}" fill="none" stroke="#3a4a6a" stroke-width="1.5"
          stroke-dasharray="3,3"/>
    {buffer_line}
    {''.join(markers)}
    <text x="{pad_l}" y="{H-8}" fill="#8a93a6" font-size="11">{fmt_day(plan.today)}</text>
    <text x="{W-pad_r-60}" y="{H-8}" fill="#8a93a6" font-size="11">{fmt_day(plan.horizon)}</text>
  </svg>
  <div class="sub" style="padding:0 8px">Blue = projected balance (expected income).
     Dashed = worst-case on confirmed income only. Green dots = income. Red band =
     below your buffer.</div></div>

  <h2>The plan — exact day to pay each thing</h2>
  <div class="grid">{''.join(cards_html)}</div>

  {('<div class="block"><h3>Credit — reported utilization</h3>'+''.join(util_html)+'</div>') if util_html else ''}
  {tax_html}

  <div class="sub" style="margin-top:18px">Money Man recommends; it never moves a
     dollar without your say-so.</div>
</div></body></html>"""
