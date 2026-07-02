import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripe-client";
import { logger } from "./logger";

/**
 * Initialise the Stripe integration on startup.
 *
 * Fully guarded: if the Stripe connection is not attached yet, this logs a
 * warning and returns without touching anything, so the server always boots
 * and the free-credit / gating features keep working. The buy-credits flow
 * activates automatically once the Stripe integration is connected and the
 * server is restarted.
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL missing; skipping Stripe init");
    return;
  }

  let stripeSync;
  try {
    // Verify the Stripe connection is available before doing any schema work.
    stripeSync = await getStripeSync();
  } catch {
    logger.warn("Stripe not connected — buy-credits stays disabled until the Stripe integration is added");
    return;
  }

  try {
    await runMigrations({ databaseUrl });

    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      const webhook = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhook: webhook?.url ?? webhookUrl }, "Stripe managed webhook ready");
    }

    // Backfill runs in the background so it never delays startup.
    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));

    logger.info("Stripe integration ready");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Stripe init failed after connecting");
  }
}
