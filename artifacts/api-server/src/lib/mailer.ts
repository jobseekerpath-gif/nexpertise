import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

// Resend's sandbox sender. Works out of the box but only delivers to the account
// owner until you verify a domain in Resend — then swap this for your own address.
const FROM = "EduBharat <onboarding@resend.dev>";

let _connectors: ReplitConnectors | null = null;
function connectors(): ReplitConnectors {
  if (!_connectors) _connectors = new ReplitConnectors();
  return _connectors;
}

/**
 * Whether the Replit Resend connector runtime is available. True on Replit
 * (dev + deployments) once the connector is attached; false when running
 * outside Replit, where we fall back to logging instead of sending.
 */
export function isEmailConfigured(): boolean {
  return !!process.env["REPLIT_CONNECTORS_HOSTNAME"];
}

/**
 * Send an email via the Resend connector. Never throws — returns { ok } so
 * callers can fire-and-forget safely. When the connector runtime is absent
 * (local/off-Replit), it logs the email and returns { ok: true, dev: true }
 * so flows that need the payload can degrade gracefully.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; dev?: boolean }> {
  if (!isEmailConfigured()) {
    logger.info({ to: opts.to, subject: opts.subject }, "[mailer] dev mode — email not sent (Resend connector not attached)");
    return { ok: true, dev: true };
  }
  try {
    const resp = await connectors().proxy("resend", "/emails", {
      method: "POST",
      body: { from: FROM, to: opts.to, subject: opts.subject, html: opts.html },
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      logger.error({ status: resp.status, detail: detail.slice(0, 300), to: opts.to }, "[mailer] Resend send failed");
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err: (err as Error).message, to: opts.to }, "[mailer] Resend send error");
    return { ok: false };
  }
}

function shell(inner: string): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
    <h2 style="color:#f97316;margin-bottom:4px">EduBharat</h2>
    ${inner}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">You're receiving this because you have an EduBharat account.</p>
  </div>`;
}

export type PaymentEmailKind = "received" | "approved" | "rejected" | "reversed";

/** Notify a user about a change to their UPI credit top-up. Fire-and-forget friendly. */
export async function sendPaymentEmail(
  to: string,
  kind: PaymentEmailKind,
  data: { credits: number; utr: string; reason?: string | null },
): Promise<{ ok: boolean; dev?: boolean }> {
  const subject: Record<PaymentEmailKind, string> = {
    received: "We've received your top-up request",
    approved: "Your EduBharat credits have been added",
    rejected: "Your top-up request was declined",
    reversed: "Your credits were reversed",
  };
  const body: Record<PaymentEmailKind, string> = {
    received: `<p>Thanks! We've received your UPI top-up request for <b>${data.credits} credits (₹${data.credits})</b>.</p>
      <p>UTR: <b>${data.utr}</b></p>
      <p>Our team will verify the payment against our account and add the credits shortly. You'll get another email once it's approved.</p>`,
    approved: `<p>Good news — your payment is verified and <b>${data.credits} credits</b> have been added to your account.</p>
      <p>UTR: <b>${data.utr}</b>. Happy learning!</p>`,
    rejected: `<p>We couldn't verify your UPI top-up for <b>${data.credits} credits</b> (UTR: <b>${data.utr}</b>), so it was declined and no credits were added.</p>
      ${data.reason ? `<p><b>Reason:</b> ${data.reason}</p>` : ""}
      <p>If you believe this is a mistake, reply to this email with your payment screenshot.</p>`,
    reversed: `<p>Your earlier top-up of <b>${data.credits} credits</b> (UTR: <b>${data.utr}</b>) has been reversed because the payment could not be confirmed in our account.</p>
      ${data.reason ? `<p><b>Reason:</b> ${data.reason}</p>` : ""}
      <p>If this is a mistake, please contact support with proof of payment.</p>`,
  };
  return sendEmail({ to, subject: subject[kind], html: shell(body[kind]) });
}
