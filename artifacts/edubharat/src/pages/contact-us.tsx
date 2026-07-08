import { PageMeta } from "@/components/page-meta";
import { useContent } from "@/lib/use-content";
import { Mail, Clock, Shield, CreditCard } from "lucide-react";

export default function ContactUs() {
  const email = useContent("contact.email", "support@edubharat.in");
  const billingEmail = useContent("contact.billing.email", "billing@edubharat.in");
  const privacyEmail = useContent("contact.privacy.email", "privacy@edubharat.in");
  const responseTime = useContent("contact.response.time", "2–3 business days");

  const channels = [
    {
      icon: Mail,
      title: "General Support",
      email,
      desc: "For help with the platform, account issues, technical problems, or any general queries.",
    },
    {
      icon: CreditCard,
      title: "Billing & Payments",
      email: billingEmail,
      desc: "For credit purchase disputes, payment verification issues, or refund requests. Please include your UPI UTR reference number.",
    },
    {
      icon: Shield,
      title: "Privacy & Data",
      email: privacyEmail,
      desc: "For data access requests, account deletion, or any concerns about your personal information under the DPDP Act, 2023.",
    },
  ];

  return (
    <div className="container mx-auto px-4 max-w-3xl py-10">
      <PageMeta
        title="Contact Us · EduBharat"
        description="Get in touch with EduBharat for support, billing queries, or privacy requests."
      />

      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-bold text-secondary mb-3">Contact Us</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          We're here to help. Reach out to the right team and we'll get back to you as quickly as possible.
        </p>
      </div>

      {/* Response time banner */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-8 text-sm text-amber-800">
        <Clock className="w-4 h-4 shrink-0" />
        <span>
          Our team typically responds within <strong>{responseTime}</strong> (Monday–Saturday, IST).
        </span>
      </div>

      {/* Contact channels */}
      <div className="space-y-4 mb-10">
        {channels.map(({ icon: Icon, title, email: e, desc }) => (
          <div key={title} className="border border-border rounded-xl p-5 flex gap-4 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-secondary mb-1">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{desc}</p>
              <a href={`mailto:${e}`} className="text-sm font-semibold text-primary hover:underline break-all">
                {e}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <section className="bg-muted/40 rounded-xl p-5">
        <h2 className="font-bold text-secondary mb-3">Before You Email</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-secondary">Login issues:</span> Try clearing cookies and logging in again, or use Google
            sign-in as an alternative. OTP emails may take a few minutes.
          </li>
          <li>
            <span className="font-medium text-secondary">Payment disputes:</span> Always include the UPI UTR reference number — we cannot
            verify your payment without it.
          </li>
          <li>
            <span className="font-medium text-secondary">AI quality feedback:</span> Mention the specific tool (e.g. Interview Ace), the
            question or context, and what response you expected vs. received.
          </li>
          <li>
            <span className="font-medium text-secondary">Account deletion:</span> Email{" "}
            <a href={`mailto:${privacyEmail}`} className="text-primary hover:underline">
              {privacyEmail}
            </a>{" "}
            from the email address registered on your account.
          </li>
          <li>
            <span className="font-medium text-secondary">Credits not added:</span> Wait at least 4 business hours after payment before
            contacting us — verification takes time.
          </li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground text-center mt-8">
        EduBharat is an online platform registered in India. All response times are in Indian Standard Time (IST).
      </p>
    </div>
  );
}
