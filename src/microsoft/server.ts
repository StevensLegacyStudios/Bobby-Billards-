import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { classifyEmail, type EmailInput } from "./extraction.js";

/**
 * The Hybrid bridge: a tiny HTTP service that Power Automate's "HTTP" action calls
 * with each inbound Outlook email. It returns the validated extraction JSON, which
 * the flow then writes into SharePoint and routes on. Run it on Azure Functions /
 * Container Apps / any host Power Automate can reach over HTTPS.
 *
 *   POST /extract   { subject, from_name, from_email, date, body, attachments[] }
 *   GET  /health
 *
 * Auth: if UMI_EXTRACT_TOKEN is set, requests must send `x-umi-token: <token>`.
 */

const PORT = Number(process.env.PORT ?? process.env.UMI_EXTRACT_PORT ?? 8787);
const TOKEN = process.env.UMI_EXTRACT_TOKEN;

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true, service: "umi-extract" });
    }
    if (req.method === "POST" && req.url === "/extract") {
      if (TOKEN && req.headers["x-umi-token"] !== TOKEN) {
        return send(res, 401, { error: "unauthorized" });
      }
      const raw = await readBody(req);
      const email = JSON.parse(raw) as EmailInput;
      if (!email || typeof email.subject !== "string" || typeof email.body !== "string") {
        return send(res, 400, { error: "expected { subject, body, ... }" });
      }
      const extraction = await classifyEmail(email);
      return send(res, 200, extraction);
    }
    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : "error" });
  }
});

// Only listen when run directly (so tests can import `server` without binding a port).
if (process.argv[1]?.includes("server")) {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`UMI extraction service listening on :${PORT} (POST /extract)`);
  });
}
