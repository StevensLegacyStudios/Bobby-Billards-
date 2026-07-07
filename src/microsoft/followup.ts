import { umiContacts } from "../kb.js";

/**
 * Vendor follow-up auto-chaser. When UMI sends a quote request, PO, submittal, or
 * closeout-doc request and the vendor goes quiet, this decides WHEN to nudge and
 * drafts WHAT to say — escalating to the PM's confirm queue after a few tries.
 *
 * Pure functions only (no I/O), so Power Automate can call the deployed service on a
 * timer with the list of open items and get back "send this / wait / escalate".
 */

export type OpenItemKind = "quote_request" | "po_confirmation" | "submittal" | "closeout_docs";

export interface OpenItem {
  kind: OpenItemKind;
  job: string;
  jobNumber?: string;
  vendor: string;
  contactName?: string;
  contactEmail?: string;
  /** The original ask, e.g. "pricing on 25 floor drains" or "PO 11836-15 confirmation". */
  ask: string;
  threadSubject: string;
  /** ISO timestamp UMI first sent the request. */
  sentAt: string;
  /** ISO timestamp of the last nudge we sent, if any. */
  lastNudgeAt?: string;
  nudgeCount: number;
  /** Optional hard deadline (e.g. bid due date) that tightens the cadence. */
  dueDate?: string;
  urgency?: "High" | "Normal" | "Low";
}

/** Business days to wait before the FIRST nudge, then between subsequent nudges. */
const CADENCE: Record<OpenItemKind, { firstAfter: number; thenEvery: number; maxNudges: number }> = {
  quote_request: { firstAfter: 2, thenEvery: 2, maxNudges: 3 },
  po_confirmation: { firstAfter: 1, thenEvery: 2, maxNudges: 3 },
  submittal: { firstAfter: 3, thenEvery: 3, maxNudges: 2 },
  closeout_docs: { firstAfter: 3, thenEvery: 4, maxNudges: 3 },
};

export interface FollowUpDecision {
  action: "send" | "wait" | "escalate";
  reason: string;
  /** Present when action === "send". A ready-to-send chaser. */
  draft?: { to: string; subject: string; body: string };
  /** Present when action === "wait": when to check again (ISO date). */
  nextCheck?: string;
}

/** Decide what to do with one open item as of `now`. */
export function evaluateFollowUp(item: OpenItem, now = new Date()): FollowUpDecision {
  const cadence = CADENCE[item.kind];

  // High urgency or an imminent deadline tightens the wait by one business day.
  const tighten = item.urgency === "High" || isDeadlineNear(item, now) ? 1 : 0;
  const firstAfter = Math.max(1, cadence.firstAfter - tighten);
  const thenEvery = Math.max(1, cadence.thenEvery - tighten);

  const anchor = new Date(item.lastNudgeAt ?? item.sentAt);
  const waited = businessDaysBetween(anchor, now);
  const needed = item.nudgeCount === 0 ? firstAfter : thenEvery;

  if (waited < needed) {
    return {
      action: "wait",
      reason: `Only ${waited} business day(s) since ${item.lastNudgeAt ? "last nudge" : "request"}; cadence wants ${needed}.`,
      nextCheck: addBusinessDays(anchor, needed).toISOString().slice(0, 10),
    };
  }

  // We've waited long enough. If we've already nudged the max number of times, the
  // vendor is non-responsive — escalate to the PM rather than nagging further.
  if (item.nudgeCount >= cadence.maxNudges) {
    return {
      action: "escalate",
      reason: `Vendor unresponsive after ${item.nudgeCount} nudge(s) on "${item.ask}". Needs a call or a backup vendor — your call.`,
    };
  }

  return {
    action: "send",
    reason: `Due for nudge #${item.nudgeCount + 1} (${waited} business days since ${item.lastNudgeAt ? "last nudge" : "the request"}).`,
    draft: draftFollowUp(item),
  };
}

/** Compose the chaser. Tone stays friendly but gets more direct with each nudge. */
export function draftFollowUp(item: OpenItem): { to: string; subject: string; body: string } {
  const to = item.contactEmail || lookupVendorEmail(item.vendor) || "";
  const name = item.contactName?.split(" ")[0] || "there";
  const jobRef = item.jobNumber ? `${item.job} (${item.jobNumber})` : item.job;
  const subject = item.threadSubject.toLowerCase().startsWith("re:")
    ? item.threadSubject
    : `RE: ${item.threadSubject}`;

  const opener =
    item.nudgeCount === 0
      ? `Just following up on the below for ${jobRef}.`
      : item.nudgeCount === 1
        ? `Circling back on this one for ${jobRef} — haven't heard back yet.`
        : `Third time checking in on ${jobRef}. I need to keep this moving, so if I don't hear back I'll need to look at other options.`;

  const ask = askLine(item);
  const closer =
    item.kind === "quote_request" || item.kind === "po_confirmation"
      ? "Can you let me know where this stands? Appreciate it."
      : "Let me know if you need anything from me to wrap this up. Thanks.";

  const body = [`Hi ${name},`, "", opener, "", ask, "", closer, "", "Thanks,", "United Mechanical"].join("\n");
  return { to, subject, body };
}

function askLine(item: OpenItem): string {
  switch (item.kind) {
    case "quote_request":
      return `Still need your pricing on: ${item.ask}.`;
    case "po_confirmation":
      return `Please confirm receipt and the ship date for: ${item.ask}.`;
    case "submittal":
      return `Checking on the submittal status for: ${item.ask}.`;
    case "closeout_docs":
      return `We're closing out ${item.job} and still need: ${item.ask}.`;
  }
}

function lookupVendorEmail(vendor: string): string | undefined {
  const needle = vendor.toLowerCase();
  const v = umiContacts.vendor.find((x) => {
    const company = (x.company ?? "").toLowerCase();
    return company !== "" && (company === needle || needle.includes(company));
  });
  return v?.email || undefined;
}

function isDeadlineNear(item: OpenItem, now: Date): boolean {
  if (!item.dueDate) return false;
  return businessDaysBetween(now, new Date(item.dueDate)) <= 2;
}

// --- business-day math (treats Sat/Sun as non-working; holidays out of scope) ---

export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let days = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}
