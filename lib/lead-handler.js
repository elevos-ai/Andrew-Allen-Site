const fs = require("fs");
const path = require("path");

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.LEAD_FORM_MAX_REQUESTS || 8);
const rateLimitStore = new Map();

const getMissingEnv = () =>
  ["LEAD_NOTIFICATION_EMAIL"].filter(
    (key) => !process.env[key] || process.env[key].trim() === ""
  );

const getClientIdentifier = (req) => {
  const forwardedFor =
    req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "";
  const firstForwarded = typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : "";

  return firstForwarded || req.headers?.["client-ip"] || req.headers?.["Client-Ip"] || "unknown";
};

const pruneRateLimitStore = (now) => {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const checkRateLimit = (req) => {
  const now = Date.now();
  pruneRateLimitStore(now);

  const clientId = getClientIdentifier(req);
  const current = rateLimitStore.get(clientId);

  if (!current || current.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };

    rateLimitStore.set(clientId, next);

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: next.resetAt,
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  rateLimitStore.set(clientId, current);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count,
    resetAt: current.resetAt,
  };
};

const parseBody = (body) => {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
};

const buildLeadRecord = (payload) => ({
  formType: payload.formType || "general",
  name: payload.name || "",
  email: payload.email || "",
  phone: payload.phone || "",
  message: payload.message || "",
  budget: payload.budget || "",
  timeframe: payload.timeframe || "",
  address: payload.address || "",
  propertyType: payload.propertyType || "",
  goal: payload.goal || "",
  sourcePage: payload.sourcePage || "",
  submittedAt: new Date().toISOString(),
});

const validateLeadRecord = (lead) => {
  if (!lead.name || !lead.email) {
    throw new Error("Name and email are required.");
  }
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatLeadFields = (lead) => [
  ["Form type", lead.formType],
  ["Name", lead.name],
  ["Email", lead.email],
  ["Phone", lead.phone],
  ["Budget", lead.budget],
  ["Timeframe", lead.timeframe],
  ["Address", lead.address],
  ["Property type", lead.propertyType],
  ["Goal", lead.goal],
  ["Message", lead.message],
  ["Source page", lead.sourcePage],
  ["Submitted at", lead.submittedAt],
].filter(([, value]) => value);

const buildLeadEmailHtml = (lead) => {
  const rows = formatLeadFields(lead)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;line-height:1.6;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="background:#f5f1ea;padding:32px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#d6ac74,#b9864f);color:#0f1115;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;">Andrew Allen Site Lead</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1;">New ${escapeHtml(
            lead.formType
          )} inquiry</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
            A new lead just came through the website. Details are below.
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

const buildLeadEmailText = (lead) =>
  [
    "Andrew Allen Site Lead",
    "",
    ...formatLeadFields(lead).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

const sendWithResend = async (lead) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      delivered: false,
      provider: "none",
      fallback: "log",
    };
  }

  const fromEmail =
    process.env.LEAD_FROM_EMAIL || "Andrew Allen Site <onboarding@resend.dev>";
  const replyTo = process.env.LEAD_REPLY_TO_EMAIL || lead.email;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [process.env.LEAD_NOTIFICATION_EMAIL],
      subject: `New ${lead.formType} lead from AndrewAllenNJ.com`,
      html: buildLeadEmailHtml(lead),
      text: buildLeadEmailText(lead),
      reply_to: replyTo,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const detail =
      result?.message || result?.error || result?.name || "Resend email request failed.";
    throw new Error(detail);
  }

  return {
    delivered: true,
    provider: "resend",
    messageId: result?.id || "",
  };
};

const saveLeadLocally = (lead) => {
  if (!process.env.LEAD_INBOX_PATH) {
    return false;
  }

  const inboxPath = path.resolve(process.env.LEAD_INBOX_PATH);
  fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
  fs.appendFileSync(inboxPath, `${JSON.stringify(lead)}\n`, "utf8");
  return true;
};

const leadHandler = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const missingEnv = getMissingEnv();

  if (missingEnv.length > 0) {
    return res.status(500).json({
      error: "Missing required environment variables.",
      missing: missingEnv,
    });
  }

  const rateLimit = checkRateLimit(req);

  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
  res.setHeader("X-RateLimit-Reset", String(rateLimit.resetAt));

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: "Lead form limit reached for now.",
      detail: "Please try again later.",
    });
  }

  try {
    const payload = parseBody(req.body);
    const lead = buildLeadRecord(payload);

    validateLeadRecord(lead);

    console.log("Lead captured for Andrew Allen site:", JSON.stringify(lead));

    const savedLocally = saveLeadLocally(lead);
    const delivery = await sendWithResend(lead);

    if (!delivery.delivered) {
      console.log(
        "Lead notification email not sent because RESEND_API_KEY is not configured yet."
      );
    }

    return res.status(200).json({
      ok: true,
      message: delivery.delivered
        ? "Lead captured successfully and notification email sent."
        : "Lead captured successfully. Email delivery is not configured yet, so the lead was logged server-side.",
      notificationEmail: process.env.LEAD_NOTIFICATION_EMAIL,
      delivery,
      savedLocally,
    });
  } catch (error) {
    return res.status(400).json({
      error: "Failed to submit lead.",
      detail: error.message,
    });
  }
};

module.exports = {
  leadHandler,
};
