import { findContact, umiContacts } from "../kb.js";
import type { Project } from "../schema/project.js";

export type EmailKind =
  | "general"
  | "rfi"
  | "submittal"
  | "bid"
  | "change_order"
  | "schedule"
  | "inspection"
  | "procurement"
  | "closeout_request"
  | "vendor_quote"
  | "po_request"
  | "foreman_alert";

export interface DraftedEmail {
  party: string;
  subject: string;
  body: string;
}

export interface DraftOptions {
  relatedId?: string | null;
  to?: string | null;
  material?: string | null;
  docLabels?: string[];
  neededBy?: string | null;
  items?: string | null;
  vendor?: string | null;
  foreman?: string | null;
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** UMI signature block — short, with name, role, phone, email per the etiquette guide. */
function signature(project: Project): string {
  const pm = (project.owner && findContact(project.owner)) || umiContacts.defaultPM;
  const line = [pm.phone, pm.email].filter(Boolean).join(" · ");
  return `\nThanks,\n${pm.name} — United Mechanical${line ? `\n${line}` : ""}`;
}

/** Job tag for subject lines: "[Job (Job#)]". */
function jobTag(project: Project): string {
  return project.jobNumber ? `[${project.name} · ${project.jobNumber}]` : `[${project.name}]`;
}

/** Best greeting name for the GC side. */
function gcName(project: Project): string {
  return project.client.contact ?? project.client.gc ?? "team";
}

/**
 * Compose a professional email body from job state, following UMI email etiquette:
 * short (3–6 sentences), purpose first, bullets for lists, action items with
 * deadlines. Deterministic so the tool is useful without the LLM; the brain may
 * pass its own subject/body when it has more context.
 */
export function draftEmail(
  project: Project,
  kind: EmailKind,
  opts: DraftOptions = {},
): DraftedEmail {
  const gc = gcName(project);
  const tag = jobTag(project);

  switch (kind) {
    case "rfi": {
      const rfi = project.rfis.find((r) => r.id === opts.relatedId) ?? project.rfis.at(-1);
      return {
        party: opts.to ?? gc,
        subject: `${tag} RFI — ${rfi?.subject ?? "Request for Information"}`,
        body:
          `Hi ${gc},\n\n` +
          `Following up — we need a clarification before we can proceed:\n\n` +
          `• ${rfi?.question ?? "(question)"}\n\n` +
          `Can you confirm so we keep the install on schedule? A quick call works too.` +
          signature(project),
      };
    }
    case "submittal": {
      const sub = project.submittals.find((s) => s.id === opts.relatedId) ?? project.submittals.at(-1);
      return {
        party: opts.to ?? gc,
        subject: `${tag} Submittal — ${sub?.spec ?? "Product Data"}`,
        body:
          `Hi ${gc},\n\n` +
          `Submitting for review and approval:\n\n` +
          `• Spec: ${sub?.spec ?? "(spec)"}\n` +
          `• ${sub?.description ?? "Product data / shop drawings attached."}\n\n` +
          `Please return approved so we can release the order. Let me know your review timeline.` +
          signature(project),
      };
    }
    case "closeout_request": {
      const docs =
        opts.docLabels && opts.docLabels.length
          ? opts.docLabels
          : ["Cut sheets / product data", "Installation instructions", "O&M manual", "Warranty documentation"];
      const by = opts.neededBy ? `by ${opts.neededBy}` : "with your submittal";
      return {
        party: opts.to ?? opts.vendor ?? "Vendor",
        subject: `${tag} Submittal + Closeout Docs — ${opts.material ?? "Material"}`,
        body:
          `Hi ${opts.vendor ?? opts.to ?? "there"},\n\n` +
          `Requesting submittal info and closeout documentation for ${opts.material ?? "this material"} on ${project.name}. ` +
          `Please send:\n\n` +
          docs.map((d) => `• ${d}`).join("\n") +
          `\n\nWe need these ${by} so closeout isn't held up at the end of the job. Thank you.` +
          signature(project),
      };
    }
    case "vendor_quote": {
      const by = opts.neededBy ? ` We need this by ${opts.neededBy}.` : "";
      return {
        party: opts.to ?? opts.vendor ?? "Vendor",
        subject: `${tag} Quote Request — ${opts.items ?? "Materials"}`,
        body:
          `Hi ${opts.vendor ?? opts.to ?? "there"},\n\n` +
          `Can you provide the following for ${project.name}:\n\n` +
          `• Quote / pricing\n` +
          `• Lead time\n` +
          `• Submittal / cut sheets\n\n` +
          `Item: ${opts.items ?? "(describe)"}.${by} Reply here or call me anytime.` +
          signature(project),
      };
    }
    case "po_request": {
      const co = project.changeOrders.find((c) => c.id === opts.relatedId);
      return {
        party: opts.to ?? umiContacts.company.poDepartmentEmail,
        subject: `PO REQUEST — ${project.name}${project.jobNumber ? ` — ${project.jobNumber}` : ""} — ${opts.vendor ?? "Vendor"} — ${opts.items ?? "Material"}`,
        body:
          `Purchasing,\n\n` +
          `Please issue a PO for the following:\n\n` +
          `• Job: ${project.name}${project.jobNumber ? ` (${project.jobNumber})` : ""}\n` +
          `• Vendor: ${opts.vendor ?? "(vendor)"}\n` +
          `• Item: ${opts.items ?? "(item)"}\n` +
          `• Amount: ${co ? money(co.costDelta) : "(quote attached)"}\n` +
          `• Required by: ${opts.neededBy ?? "(date)"}\n\n` +
          `Tag material with the PO#. Please send confirmation once issued.` +
          signature(project),
      };
    }
    case "foreman_alert": {
      const foreman = opts.foreman ? findContact(opts.foreman) : undefined;
      const party = foreman?.email ?? opts.to ?? opts.foreman ?? "Foreman";
      return {
        party,
        subject: `DELIVERY TOMORROW — ${project.name} — ${opts.items ?? "Materials"}`,
        body:
          `Hi ${foreman?.name ?? opts.foreman ?? "there"},\n\n` +
          `Materials are delivering tomorrow for ${project.name}:\n\n` +
          `• Item: ${opts.items ?? "(item)"}\n` +
          `• Vendor: ${opts.vendor ?? "(vendor)"}\n` +
          `• Deliver to: ${project.location.address ?? "(jobsite)"}\n\n` +
          `Please confirm receipt and flag any damage or shortage. Call me if anything comes up.` +
          signature(project),
      };
    }
    case "bid": {
      const total = project.bid.waterfall.total;
      const flagged = project.bid.assumptionFlags.length > 0;
      return {
        party: opts.to ?? gc,
        subject: `${tag} Proposal — ${project.division} TI`,
        body:
          `Hi ${gc},\n\n` +
          `Thanks for the opportunity to bid ${project.name}. ` +
          `Our proposed price is ${total > 0 ? money(total) : "(pending final numbers)"} for the ${project.division.toLowerCase()} scope per the documents.` +
          (flagged
            ? `\n\nNote: this is being finalized pending confirmation of current prevailing-wage/CBA rates — not yet for contract.`
            : ``) +
          `\n\nHappy to walk through inclusions/exclusions whenever works.` +
          signature(project),
      };
    }
    case "change_order": {
      const co = project.changeOrders.find((c) => c.id === opts.relatedId) ?? project.changeOrders.at(-1);
      return {
        party: opts.to ?? gc,
        subject: `${tag} Change Order${co ? ` — ${co.description}` : ""}`,
        body:
          `Hi ${gc},\n\n` +
          `Submitting a change that impacts our scope on ${project.name}:\n\n` +
          `• ${co?.description ?? "(description)"}\n` +
          `• Cost impact: ${co ? money(co.costDelta) : "(pending)"}\n\n` +
          `Please confirm approval — this work is outside the base contract.` +
          signature(project),
      };
    }
    case "schedule": {
      const finish = project.schedule.tasks.at(-1)?.finish;
      return {
        party: opts.to ?? gc,
        subject: `${tag} Plumbing Schedule Update`,
        body:
          `Hi ${gc},\n\n` +
          `Quick schedule update for ${project.name}` +
          (project.schedule.startDate ? ` (start ${project.schedule.startDate}` : ``) +
          (finish ? `, projected finish ${finish}).` : project.schedule.startDate ? `).` : `.`) +
          `\n\nWe'll sequence underground → rough-in → top-out → trim, with inspections gating each phase. ` +
          `Let me know of any GC milestones to align to.` +
          signature(project),
      };
    }
    case "procurement": {
      const open = project.procurement.filter((p) => p.status !== "delivered");
      return {
        party: opts.to ?? gc,
        subject: `${tag} Long-Lead Procurement`,
        body:
          `Hi ${gc},\n\n` +
          `Flagging long-lead material on ${project.name} to protect the schedule:\n\n` +
          (open.length
            ? open.map((p) => `• ${p.item}${p.needBy ? ` — need by ${p.needBy}` : ""} (${p.status})`).join("\n")
            : `• (no open procurement items)`) +
          `\n\nPlease confirm releases so we can place orders.` +
          signature(project),
      };
    }
    case "inspection": {
      return {
        party: opts.to ?? gc,
        subject: `${tag} Inspection Coordination`,
        body:
          `Hi ${gc},\n\n` +
          `We're ready for the next plumbing inspection on ${project.name}. ` +
          `Can you confirm inspector availability and site access so we stay ahead of cover?` +
          signature(project),
      };
    }
    default:
      return {
        party: opts.to ?? gc,
        subject: `${tag} Update`,
        body: `Hi ${gc},\n\n(Compose your message.)` + signature(project),
      };
  }
}
