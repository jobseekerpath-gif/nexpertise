---
name: Email via Resend connector
description: How EduBharat sends email (Replit Resend connector) and the sandbox-sender gotcha that looks like a broken integration
---

- Email is sent through the **Replit Resend connector** (the `@replit/connectors-sdk` proxy), NOT a raw `RESEND_API_KEY`. Whether email is "configured" is inferred from the connector runtime being present, not from an API key — there is no email API key to set. The connector handles auth/token refresh.

- **Resend sandbox-sender restriction — looks like a bug, isn't.** The default `from` is Resend's shared sandbox address `onboarding@resend.dev`, which **only delivers to the Resend account owner's own email**. Sending to any other recipient returns a Resend **403 `validation_error`** ("You can only send testing emails to your own email address …"). This is a Resend account limitation, not broken connector wiring. **Fix:** verify a domain at resend.com/domains and change the `from` to that domain — then it delivers to anyone.

- **Diagnose "email not arriving" by the logged status:** a **403** from the mailer = sandbox/unverified-domain restriction (verify a domain). A **401 / network error** = connector attachment/identity problem. They are distinct — read the status before assuming the pipeline is broken.

- **Security invariant — never leak the OTP code on a real send failure.** The OTP `dev` code is returned in the send response **only** when the connector runtime is absent (off-Replit dev). When email IS configured but the send fails, respond with an error (5xx) and do NOT include the code — otherwise anyone could harvest login codes by forcing a send failure.

- **Why:** each of these has cost real debugging time — the 403 masquerades as a broken integration, and returning the dev code on failure would be a silent auth bypass.
