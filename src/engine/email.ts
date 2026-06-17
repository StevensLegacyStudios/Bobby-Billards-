import type { Project } from "../schema/project.js";

export type EmailKind =
  | "general"
  | "rfi"
  | "submittal"
  | "bid"
  | "change_order"
  | "schedule"
  | "inspection"
  | "procurement";

export interface DraftedEmail {
  party: string;
  subject: string;
  body: string;
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signature(project: Project): string {
  const who = project.owner ?? "Project Manager";
  return `\nRegards,\n${who}\n${project.name}`;
}

function jobTag(project: Project): string {
  return `[${project.name}]`;
}

/**
 * Compose a professional email body from job state for the given kind. This is a
 * deterministic fallback so the tool is useful even without the LLM; when the
 * brain has more context it can pass its own subject/body instead.
 */
export function draftEmail(
  project: Project,
  kind: EmailKind,
  relatedId: string | null,
): DraftedEmail {
  const gc = project.client.gc ?? project.client.contact ?? "team";
  const tag = jobTag(project);

  switch (kind) {
    case "rfi": {
      const rfi = project.rfis.find((r) => r.id === relatedId) ?? project.rfis.at(-1);
      return {
        party: gc,
        subject: `${tag} RFI — ${rfi?.subject ?? "Request for Information"}`,
        body:
          `Hi ${gc},\n\n` +
          `We need clarification before we can proceed on ${project.name}:\n\n` +
          `RFI: ${rfi?.subject ?? "(subject)"}\n` +
          `${rfi?.question ?? "(question)"}\n\n` +
          `Please advise so we can keep the install on schedule. Let me know if a quick call would be faster.` +
          signature(project),
      };
    }
    case "submittal": {
      const sub = project.submittals.find((s) => s.id === relatedId) ?? project.submittals.at(-1);
      return {
        party: gc,
        subject: `${tag} Submittal — ${sub?.spec ?? "Product Data"}`,
        body:
          `Hi ${gc},\n\n` +
          `Please find our submittal for review and approval on ${project.name}:\n\n` +
          `Spec section: ${sub?.spec ?? "(spec)"}\n` +
          `${sub?.description ?? "Product data / shop drawings attached."}\n\n` +
          `Kindly return reviewed/approved so we can release the order against the schedule.` +
          signature(project),
      };
    }
    case "bid": {
      const total = project.bid.waterfall.total;
      const flagged = project.bid.assumptionFlags.length > 0;
      return {
        party: gc,
        subject: `${tag} Proposal — Plumbing TI`,
        body:
          `Hi ${gc},\n\n` +
          `Thank you for the opportunity to bid the plumbing scope on ${project.name}.\n\n` +
          `Our proposed price is ${total > 0 ? money(total) : "(pending final numbers)"}, ` +
          `covering the DWV, domestic water, gas, and fixture scope per the documents.\n\n` +
          (flagged
            ? `Note: this number is being finalized pending confirmation of current ` +
              `prevailing-wage/CBA rates and is not yet for contract.\n\n`
            : ``) +
          `Happy to walk through inclusions/exclusions at your convenience.` +
          signature(project),
      };
    }
    case "change_order": {
      const co = project.changeOrders.find((c) => c.id === relatedId) ?? project.changeOrders.at(-1);
      return {
        party: gc,
        subject: `${tag} Change Order Request${co ? ` — ${co.description}` : ""}`,
        body:
          `Hi ${gc},\n\n` +
          `The following change impacts our plumbing scope on ${project.name}:\n\n` +
          `${co?.description ?? "(description)"}\n` +
          `Cost impact: ${co ? money(co.costDelta) : "(pending)"}\n\n` +
          `Please confirm so we can proceed; this work is not included in the base contract.` +
          signature(project),
      };
    }
    case "schedule": {
      const finish = project.schedule.tasks.at(-1)?.finish;
      return {
        party: gc,
        subject: `${tag} Plumbing Schedule Update`,
        body:
          `Hi ${gc},\n\n` +
          `Here is the current plumbing install sequence for ${project.name}` +
          (project.schedule.startDate ? ` (start ${project.schedule.startDate}` : ``) +
          (finish ? `, projected finish ${finish}).` : project.schedule.startDate ? `).` : `.`) +
          `\n\nWe will sequence underground → rough-in → top-out → trim, with inspections gating each phase. ` +
          `Let me know of any GC milestones we should align to.` +
          signature(project),
      };
    }
    case "procurement": {
      const open = project.procurement.filter((p) => p.status !== "delivered");
      return {
        party: gc,
        subject: `${tag} Long-Lead Procurement`,
        body:
          `Hi ${gc},\n\n` +
          `Flagging long-lead material on ${project.name} so we protect the schedule:\n\n` +
          (open.length
            ? open.map((p) => `• ${p.item}${p.needBy ? ` — need by ${p.needBy}` : ""} (${p.status})`).join("\n")
            : `• (no open procurement items)`) +
          `\n\nPlease confirm approvals/releases so we can place orders.` +
          signature(project),
      };
    }
    case "inspection": {
      return {
        party: gc,
        subject: `${tag} Inspection Coordination`,
        body:
          `Hi ${gc},\n\n` +
          `We're ready to coordinate the next plumbing inspection on ${project.name}. ` +
          `Please confirm inspector availability and access so we can stay ahead of cover.` +
          signature(project),
      };
    }
    default:
      return {
        party: gc,
        subject: `${tag} Update`,
        body: `Hi ${gc},\n\n(Compose your message.)` + signature(project),
      };
  }
}
