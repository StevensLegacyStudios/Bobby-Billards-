import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { umiContacts } from "../kb.js";

/**
 * The "smart part" of the Hybrid Microsoft 365 build: Power Automate captures each
 * inbound Outlook email and POSTs it here; this module asks Claude to classify and
 * extract structured fields (the UMI System Bible's Section 5 prompt, tuned and
 * extended with Closeout Docs + Change Order categories), validated with zod so
 * the flow always gets a clean, predictable JSON shape.
 */

export const EMAIL_CATEGORIES = [
  "Bid Invite",
  "Bid Pricing Request",
  "Vendor Quote Request",
  "PO Confirmation",
  "Delivery Update",
  "Submittal Submission",
  "Submittal Approval",
  "Closeout Docs",
  "Change Order",
  "RFI Field Coordination",
  "Acknowledgment",
  "General Other",
] as const;

export const ACTION_TYPES = [
  "Bid Decision Needed",
  "Quote Approval Needed",
  "PO Request to Send",
  "Foreman Alert Needed",
  "Vendor Follow-Up Needed",
  "Submittal Action Needed",
  "Closeout Doc to File",
  "Field Response Needed",
  "No Action",
] as const;

/** Coerce loose model output (numbers-as-strings, missing keys) into a clean shape. */
export const ExtractionSchema = z.object({
  email_category: z.string().default("General Other"),
  job_name: z.string().default(""),
  job_number: z.string().default(""),
  job_location: z.string().default(""),
  gc_or_customer: z.string().default(""),
  vendor: z.string().default(""),
  vendor_contact_name: z.string().default(""),
  vendor_contact_email: z.string().default(""),
  vendor_contact_phone: z.string().default(""),
  sender_role: z.string().default(""),
  po_number: z.string().default(""),
  order_number: z.string().default(""),
  item_description: z.string().default(""),
  quantity: z.string().default(""),
  amount: z.string().default(""),
  delivery_date: z.string().default(""),
  bid_due_date: z.string().default(""),
  job_walk_date: z.string().default(""),
  submittal_number: z.string().default(""),
  submittal_status: z.string().default(""),
  lead_times_raw: z.string().default(""),
  delivery_location: z.string().default(""),
  delivery_attn: z.string().default(""),
  /** which closeout docs (cut sheet, O&M, warranty, as-built) the email concerns */
  closeout_docs: z.string().default(""),
  action_required: z.coerce.boolean().default(false),
  action_type: z.string().default("No Action"),
  urgency: z.enum(["High", "Normal", "Low"]).catch("Normal"),
  summary: z.string().default(""),
  confidence: z.coerce.number().default(0),
  needs_review: z.coerce.boolean().default(false),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export interface EmailInput {
  subject: string;
  from_name?: string;
  from_email?: string;
  date?: string;
  body: string;
  attachments?: string[];
}

/** The exact prompt sent to Claude. Faithful to the Bible, extended for closeout/CO. */
export function buildExtractionPrompt(email: EmailInput): string {
  const vendors = umiContacts.vendor.map((v) => v.company).join(", ");
  const gcs = [...new Set(umiContacts.gc.map((g) => g.company))].join(", ");
  return `You are an email parser for United Mechanical (UMI), a commercial HVAC and plumbing contractor in the San Francisco Bay Area.

Known GCs: ${gcs}. Known vendors: ${vendors}. The same job is referenced many ways (e.g. "Perplexity", "PPLX", "181 Fremont", "10th & 11th Floors" are one job; match on name OR address OR job number).

Analyze the following email carefully (parse the WHOLE chain, not just the latest reply):
SUBJECT: ${email.subject}
FROM: ${email.from_name ?? ""} <${email.from_email ?? ""}>
DATE: ${email.date ?? ""}
ATTACHMENTS: ${(email.attachments ?? []).join(", ")}
BODY:
${email.body}

Return ONLY valid JSON (no markdown, no prose) with these keys:
{"email_category":"","job_name":"","job_number":"","job_location":"","gc_or_customer":"","vendor":"","vendor_contact_name":"","vendor_contact_email":"","vendor_contact_phone":"","sender_role":"","po_number":"","order_number":"","item_description":"","quantity":"","amount":"","delivery_date":"","bid_due_date":"","job_walk_date":"","submittal_number":"","submittal_status":"","lead_times_raw":"","delivery_location":"","delivery_attn":"","closeout_docs":"","action_required":false,"action_type":"","urgency":"","summary":"","confidence":0.0,"needs_review":false}

FIELD RULES:
- email_category: exactly one of ${EMAIL_CATEGORIES.map((c) => `"${c}"`).join(", ")}.
  • "Closeout Docs" = the email is about as-builts, O&M manuals, cut sheets, or warranty documentation.
  • "Change Order" = a PCO/CO, added/changed scope, or pricing for extra work.
- sender_role: one of "GC","Vendor","Internal","Subcontractor","Owner","Architect","Unknown".
- action_type: exactly one of ${ACTION_TYPES.map((a) => `"${a}"`).join(", ")}.
- lead_times_raw: copy any lead-time text verbatim (e.g. "EWH11-1 FACTORY 6-8 WEEKS, S2-FCT STOCKTON DC 1 DAY").
- closeout_docs: list any closeout doc types mentioned (cut sheet, O&M, installation, warranty, as-built).
- urgency: "High" (field work blocked, bid due <48h, delivery tomorrow), "Normal", or "Low" (FYI/acknowledgment).
- summary: 1-2 plain sentences.
- confidence: 0.00-1.00 over all fields; if < 0.70 set needs_review true.
- Dates ambiguous ("next Thursday") that you can't resolve to an exact date → leave "" and set needs_review true.
- Missing field → "" (text), 0 (number), false (boolean). Return ONLY the JSON object.`;
}

export interface ClassifyOptions {
  client?: Anthropic;
  model?: string;
}

/** Call Claude and return a validated Extraction. Throws if the model returns no JSON. */
export async function classifyEmail(
  email: EmailInput,
  opts: ClassifyOptions = {},
): Promise<Extraction> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? process.env.UMI_EXTRACT_MODEL ?? "claude-opus-4-8";
  const res = await client.messages.create({
    model,
    max_tokens: 1500,
    messages: [{ role: "user", content: buildExtractionPrompt(email) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseExtraction(text);
}

/** Pull the first JSON object out of a model response and validate it. */
export function parseExtraction(text: string): Extraction {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in model response.");
  return ExtractionSchema.parse(JSON.parse(match[0]));
}
