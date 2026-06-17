/*
 * Money Man OS - Liquidity Maximizer engine (JavaScript port).
 *
 * Same logic as money-man-os-prototype/liquidity_maximizer.py:
 * compute the exact day to pay each bill to keep the most cash on hand AND
 * lift credit utilization, on irregular income, without overdraft or late fee.
 *
 * Runs in the browser (attaches to window.MoneyMan) and in Node (module.exports)
 * so it can be unit-tested. No dependencies.
 */
(function (root) {
  "use strict";

  const PROCESSING_BUFFER_DAYS = 2;
  const SAFE_CONFIDENCE = 0.8;
  const TAX_SET_ASIDE_RATE = 0.25;
  const UTIL_GREAT = 0.09;
  const UTIL_GOOD = 0.29;
  const LIQUIDITY_CUSHION = 150.0;
  const MIN_MEANINGFUL_PAYDOWN = 20.0;

  // ---- date helpers (UTC-midnight, integer day math) --------------------- //
  function toDay(d) {
    if (d instanceof Date) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    const [y, m, day] = String(d).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  function addDays(d, n) {
    const x = toDay(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }
  function diffDays(a, b) {
    return Math.round((toDay(a) - toDay(b)) / 86400000);
  }
  function key(d) {
    return toDay(d).toISOString().slice(0, 10);
  }
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fmtDay(d) {
    const x = toDay(d);
    return `${DOW[x.getUTCDay()]} ${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
  }
  function money(x) {
    const n = Math.round(x);
    return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");
  }
  const isSafe = (e) => e.confidence >= SAFE_CONFIDENCE;

  // ---- simulator: worst-case intraday (outflows before inflows) ---------- //
  function simulate(startBalance, today, horizon, incomes, payments, incomeFilter) {
    const inflow = {}, outflow = {};
    for (const e of incomes) {
      if (incomeFilter(e) && diffDays(e.date, today) >= 0 && diffDays(e.date, horizon) <= 0) {
        inflow[key(e.date)] = (inflow[key(e.date)] || 0) + e.amount;
      }
    }
    for (const p of payments) {
      if (diffDays(p.date, today) >= 0 && diffDays(p.date, horizon) <= 0) {
        outflow[key(p.date)] = (outflow[key(p.date)] || 0) + p.amount;
      }
    }
    const series = [];
    let bal = startBalance, minLow = startBalance, minLowDate = toDay(today);
    const n = diffDays(horizon, today);
    for (let i = 0; i <= n; i++) {
      const d = addDays(today, i);
      const low = bal - (outflow[key(d)] || 0);
      bal = low + (inflow[key(d)] || 0);
      series.push({ date: d, bal, low });
      if (low < minLow) { minLow = low; minLowDate = d; }
    }
    return { series, minLow, minLowDate };
  }

  // ---- the optimizer ----------------------------------------------------- //
  function buildPlan(account, incomes, bills, cards, today, horizonDays) {
    horizonDays = horizonDays || 35;
    today = toDay(today);
    const horizon = addDays(today, horizonDays);
    const payments = [];
    const notes = [];

    // 1) Bills: pay as late as safely possible to preserve cash.
    for (const b of bills) {
      const earliest = b.earliest_pay ? toDay(b.earliest_pay) : today;
      const latestSafe = addDays(b.due_date, -PROCESSING_BUFFER_DAYS);
      let payDate = [earliest, latestSafe, today].reduce((a, c) => (c > a ? c : a));
      if (b.flexible === false) payDate = toDay(b.due_date);
      let reason;
      if (b.credit_impact) {
        reason = `Protects your credit: a late ${b.kind} payment reports to the ` +
          `bureaus. Paid ${PROCESSING_BUFFER_DAYS}d before the ${fmtDay(b.due_date)} ` +
          `due date, not early - keep the cash.`;
      } else if (b.shutoff_or_lapse) {
        const risk = b.kind === "insurance" ? "lapse" : "shut-off";
        reason = `No credit impact, but ${risk} risk. Held until just before ` +
          `${fmtDay(b.due_date)} to keep cash on hand, then paid.`;
      } else {
        reason = `No credit impact. Held as late as safe (just before ` +
          `${fmtDay(b.due_date)}) so the money stays in your pocket as long as possible.`;
      }
      payments.push({ date: payDate, amount: b.amount, label: b.name, reason,
        kind: b.kind, credit_impact: !!b.credit_impact });
    }

    // 2) Credit cards, highest utilization first.
    const cardResults = {};
    const sorted = cards.slice().sort((a, b) =>
      (b.balance / b.limit) - (a.balance / a.limit));
    for (const c of sorted) {
      const util = c.limit ? c.balance / c.limit : 0;
      if (diffDays(c.statement_close, today) < 0) {
        notes.push(`${c.name}: statement already closed this cycle - target the next close date instead.`);
        cardResults[c.name] = { before: util, after: util, paid: 0 };
        continue;
      }
      let target = addDays(c.statement_close, -PROCESSING_BUFFER_DAYS);
      if (target < today) target = today;

      const { series } = simulate(account.balance, today, horizon, incomes, payments, isSafe);
      const fwdLows = series.filter(r => diffDays(r.date, target) >= 0).map(r => r.low);
      const headroom = Math.max(0, (fwdLows.length ? Math.min(...fwdLows) : 0) - account.buffer);

      const pdGood = Math.max(0, c.balance - UTIL_GOOD * c.limit);
      const pdGreat = Math.max(0, c.balance - UTIL_GREAT * c.limit);
      let extra;
      if (headroom >= pdGreat + LIQUIDITY_CUSHION) extra = pdGreat;
      else if (headroom >= pdGood) extra = pdGood;
      else extra = headroom;
      extra = Math.round(Math.min(extra, c.balance) * 100) / 100;
      const newUtil = (c.balance - extra) / c.limit;
      const meaningful = extra >= MIN_MEANINGFUL_PAYDOWN && (util - newUtil) >= 0.02;

      if (extra <= 0 || !meaningful) {
        notes.push(`${c.name}: no spare cash before it reports on ` +
          `${fmtDay(c.statement_close)} without risking your ${money(account.buffer)} ` +
          `buffer. Utilization stays ${pct(util)}. Biggest lever here is more income first.`);
        cardResults[c.name] = { before: util, after: util, paid: 0 };
        payments.push({ date: maxDate(today, addDays(c.due_date, -PROCESSING_BUFFER_DAYS)),
          amount: c.min_payment, label: `${c.name} - minimum`,
          reason: `Protects payment history (the biggest credit factor). Minimum only, ` +
            `by ${fmtDay(c.due_date)} - cash is too tight to do more.`,
          kind: "credit_card", credit_impact: true });
        continue;
      }

      let crossed = "";
      if (util > UTIL_GOOD && newUtil <= UTIL_GOOD) crossed = " - crosses under the 30% line that lenders watch";
      if (newUtil <= UTIL_GREAT) crossed = " - lands in the under-10% sweet spot";
      const reason = `Pay ${money(extra)} before it reports on ${fmtDay(c.statement_close)} ` +
        `so utilization drops ${pct(util)} -> ${pct(newUtil)}${crossed}. Paid only what keeps ` +
        `your ${money(account.buffer)} buffer safe - the rest of your cash stays liquid.`;
      payments.push({ date: target, amount: extra, label: `${c.name} - paydown`, reason,
        kind: "credit_card", credit_impact: true, util_before: util, util_after: newUtil });
      cardResults[c.name] = { before: util, after: newUtil, paid: extra };

      if (extra < c.min_payment) {
        payments.push({ date: maxDate(today, addDays(c.due_date, -PROCESSING_BUFFER_DAYS)),
          amount: Math.round((c.min_payment - extra) * 100) / 100,
          label: `${c.name} - minimum top-up`,
          reason: `Tops the paydown up to the ${money(c.min_payment)} minimum by ` +
            `${fmtDay(c.due_date)} to protect payment history.`,
          kind: "credit_card", credit_impact: true });
      }
    }

    // 3) Final safety pass on confirmed income.
    const safeSim = simulate(account.balance, today, horizon, incomes, payments, isSafe);
    const expSim = simulate(account.balance, today, horizon, incomes, payments, () => true);
    const safeToSpend = Math.max(0, safeSim.minLow - account.buffer);

    let runwayDays = null;
    for (const r of safeSim.series) {
      if (r.low < account.buffer) { runwayDays = diffDays(r.date, today); break; }
    }

    // 4) Alerts + required income.
    const alerts = [];
    if (safeSim.minLow < account.buffer) {
      const shortfall = account.buffer - safeSim.minLow;
      const expLows = expSim.series.filter(r => diffDays(r.date, safeSim.minLowDate) <= 0).map(r => r.low);
      const expLowByDate = expLows.length ? Math.min(...expLows) : safeSim.minLow;
      if (expLowByDate >= account.buffer) {
        alerts.push(`TIGHT: by ${fmtDay(safeSim.minLowDate)} you dip ` +
          `${money(account.buffer - safeSim.minLow)} under your buffer on CONFIRMED money. ` +
          `Expected gig/job income covers it - but it's not guaranteed. Earn ${money(shortfall)} ` +
          `before then to be safe.`);
      } else {
        alerts.push(`AT RISK: you need about ${money(shortfall)} more by ` +
          `${fmtDay(safeSim.minLowDate)} or you break your ${money(account.buffer)} buffer - ` +
          `even counting expected income. This is the number to drive to.`);
      }
    }

    // 5) Tax set-aside.
    const taxNotes = [];
    let taxTotal = 0;
    for (const e of incomes) {
      if (e.is_1099 && diffDays(e.date, today) >= 0 && diffDays(e.date, horizon) <= 0) {
        const setaside = Math.round(e.amount * TAX_SET_ASIDE_RATE * 100) / 100;
        taxTotal += setaside;
        taxNotes.push(`${fmtDay(e.date)}: ${e.source} ${money(e.amount)} (1099) - set aside ${money(setaside)} for taxes.`);
      }
    }
    taxTotal = Math.round(taxTotal * 100) / 100;

    payments.sort((a, b) => toDay(a.date) - toDay(b.date));
    const status = (alerts.length === 0 && runwayDays === null) ? "SAFE"
      : (runwayDays !== null ? "AT RISK" : "TIGHT");

    return {
      today, horizon, account, payments, incomes, bills, cards,
      safe_to_spend: Math.round(safeToSpend * 100) / 100,
      runway_days: runwayDays, min_low_safe: Math.round(safeSim.minLow * 100) / 100,
      min_low_safe_date: safeSim.minLowDate, alerts, notes,
      tax_set_aside: taxTotal, tax_notes: taxNotes,
      series_safe: safeSim.series, series_expected: expSim.series, status,
    };
  }

  function pct(x) { return Math.round(x * 100) + "%"; }
  function maxDate(a, b) { return toDay(a) > toDay(b) ? toDay(a) : toDay(b); }

  const api = { buildPlan, simulate, fmtDay, money, pct, addDays, toDay, diffDays,
    PROCESSING_BUFFER_DAYS, SAFE_CONFIDENCE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MoneyMan = api;
})(typeof window !== "undefined" ? window : globalThis);
