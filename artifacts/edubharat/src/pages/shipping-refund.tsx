import { PageMeta } from "@/components/page-meta";
import { useContent } from "@/lib/use-content";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-secondary mt-8 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground mb-3">{children}</ul>;
}

export default function ShippingRefund() {
  const email = useContent("contact.billing.email", "billing@edubharat.in");

  return (
    <div className="container mx-auto px-4 max-w-3xl py-10">
      <PageMeta
        title="Shipping & Refund Policy · EduBharat"
        description="EduBharat's shipping and refund policy for digital credit purchases."
      />
      <h1 className="text-3xl font-display font-bold text-secondary mb-2">Shipping &amp; Refund Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: July 2025</p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-8 text-sm text-blue-800">
        EduBharat is a <strong>100% digital platform</strong>. We do not sell or ship any physical products. There are no shipping fees,
        delivery timelines, or physical returns applicable.
      </div>

      <H2>1. Credit Purchases</H2>
      <P>EduBharat uses a credit-based system for premium AI features (1 credit = ₹1). The purchase process:</P>
      <UL>
        <li>You complete a UPI payment and submit your UTR (Transaction Reference Number) in the app</li>
        <li>Our team verifies the UTR against our payment records within 1–4 business hours</li>
        <li>Credits are added to your account after successful verification</li>
        <li>You receive a credit ledger update visible in your account dashboard</li>
      </UL>
      <P>
        Credits are non-transferable between accounts and do not expire. Credits are debited automatically when you use premium AI features.
      </P>

      <H2>2. Refund Eligibility</H2>
      <P>We aim to be fair and transparent. Refund eligibility:</P>
      <UL>
        <li>
          <strong className="text-green-700">Eligible:</strong> Paid credits that have not been used, disputed within 7 days of purchase
        </li>
        <li>
          <strong className="text-green-700">Eligible:</strong> Duplicate payments (same UTR accidentally credited twice)
        </li>
        <li>
          <strong className="text-green-700">Eligible:</strong> Failed UPI transaction where money was debited but credits were not added
          after 8 hours
        </li>
        <li>
          <strong className="text-red-600">Not eligible:</strong> Credits that have already been consumed (the AI service was delivered)
        </li>
        <li>
          <strong className="text-red-600">Not eligible:</strong> Free/bonus signup credits
        </li>
        <li>
          <strong className="text-red-600">Not eligible:</strong> Dissatisfaction with AI-generated content quality
        </li>
        <li>
          <strong className="text-red-600">Not eligible:</strong> Refund requests submitted after 7 days of the purchase date
        </li>
      </UL>

      <H2>3. How to Request a Refund</H2>
      <P>
        Email us at{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline font-medium">
          {email}
        </a>{" "}
        with the following:
      </P>
      <UL>
        <li>Your registered email address on EduBharat</li>
        <li>UPI UTR (Transaction Reference Number) — found in your payment app's transaction history</li>
        <li>Amount paid (₹)</li>
        <li>Date of payment</li>
        <li>Reason for refund request</li>
        <li>UPI ID for the refund (must match the original payment source)</li>
      </UL>
      <P>
        <strong>Subject line:</strong> "Refund Request – [Your UTR Number]"
      </P>

      <H2>4. Refund Processing</H2>
      <UL>
        <li>
          <strong>Review period:</strong> 2–3 business days to verify your request and payment records
        </li>
        <li>
          <strong>Refund timeline:</strong> 7–10 business days after approval
        </li>
        <li>
          <strong>Refund method:</strong> Returned via UPI to your original payment account
        </li>
        <li>
          <strong>Notification:</strong> You will receive an email confirmation once the refund is processed
        </li>
      </UL>

      <H2>5. Failed / Pending Transactions</H2>
      <P>
        If your UPI payment was deducted but credits were not added within 8 hours, please do not resubmit the payment. Instead, email{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>{" "}
        with your UTR and we will investigate and either add the credits or process a refund.
      </P>

      <H2>6. Disputes and Escalation</H2>
      <P>If your refund request is not resolved to your satisfaction, you may:</P>
      <UL>
        <li>
          Escalate by emailing{" "}
          <a href="mailto:support@edubharat.in" className="text-primary hover:underline">
            support@edubharat.in
          </a>{" "}
          with "ESCALATION" in the subject line
        </li>
        <li>Contact your bank or UPI provider to dispute the transaction (for clearly failed payments)</li>
        <li>
          File a consumer complaint under the Consumer Protection Act, 2019 through the National Consumer Helpline (1800-11-4000) or the
          online portal at consumerhelpline.gov.in
        </li>
      </UL>
      <P>EduBharat is committed to resolving all genuine payment disputes fairly and transparently.</P>

      <H2>7. Contact</H2>
      <P>
        For all billing and refund queries:{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
        <br />
        Response time: 2–3 business days (Monday–Saturday, IST)
      </P>
    </div>
  );
}
