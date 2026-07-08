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

export default function PrivacyPolicy() {
  const email = useContent("contact.privacy.email", "privacy@edubharat.in");
  const company = useContent("legal.company.name", "EduBharat");

  return (
    <div className="container mx-auto px-4 max-w-3xl py-10">
      <PageMeta
        title="Privacy Policy · EduBharat"
        description="EduBharat's privacy policy — how we collect, use, and protect your personal data."
      />
      <h1 className="text-3xl font-display font-bold text-secondary mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-2">Last updated: July 2025</p>
      <p className="text-xs text-muted-foreground/70 mb-8">
        Compliant with India's Digital Personal Data Protection Act, 2023 (DPDP Act)
      </p>

      <P>
        This Privacy Policy describes how {company} ("we", "us", or "our") collects, uses, and protects your personal information when you
        use our platform. By using EduBharat, you consent to the practices described in this policy.
      </P>

      <H2>1. Information We Collect</H2>
      <P>
        <strong>Account Information:</strong>
      </P>
      <UL>
        <li>Email address (used for login and communication)</li>
        <li>Name (used for personalisation)</li>
        <li>Profile information you provide: age, location, education, career goals, experience level, and preferences</li>
        <li>Profile picture (only if signing in with Google)</li>
      </UL>
      <P>
        <strong>Usage Information:</strong>
      </P>
      <UL>
        <li>Tools used, session duration, and feature interactions</li>
        <li>Learning progress, scores, and interview session data</li>
        <li>Speech transcripts from Interview Ace and English Guru (stored only in your history)</li>
        <li>Resume text you upload or paste for analysis</li>
      </UL>
      <P>
        <strong>Technical Information:</strong>
      </P>
      <UL>
        <li>IP address (for account security and admin visibility)</li>
        <li>Browser type and device information (via HTTP headers)</li>
        <li>Session cookies required for authentication</li>
      </UL>

      <H2>2. How We Use Your Information</H2>
      <UL>
        <li>Provide and personalise AI-powered learning tools</li>
        <li>Authenticate your account and maintain session security</li>
        <li>Send transactional emails (OTP codes, payment confirmations)</li>
        <li>Display your progress and history within the app</li>
        <li>Detect and prevent fraud or platform abuse</li>
        <li>Improve our services using aggregate, anonymised data only</li>
      </UL>
      <P>
        We do <strong>not</strong> use your personal data for advertising. We do <strong>not</strong> sell your data to any third party,
        ever.
      </P>

      <H2>3. Third-Party Services</H2>
      <P>We use the following third-party services, each with their own privacy policies:</P>
      <UL>
        <li>
          <strong>Google (OAuth):</strong> Sign-in authentication —{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Privacy Policy
          </a>
        </li>
        <li>
          <strong>Resend:</strong> Transactional email delivery (OTP and account notifications)
        </li>
        <li>
          <strong>Adzuna:</strong> Job listings API (only your search query is sent; your profile is never shared)
        </li>
        <li>
          <strong>Replit:</strong> Cloud hosting infrastructure for servers and database
        </li>
        <li>
          <strong>Anthropic Claude &amp; Google Gemini:</strong> AI model APIs (prompts are sent without personally identifiable
          information where possible; neither provider trains on your data by default per their enterprise policies)
        </li>
        <li>
          <strong>Microsoft Edge TTS:</strong> Text-to-speech audio generation for AI tutor voices
        </li>
      </UL>

      <H2>4. Data Retention</H2>
      <UL>
        <li>Account data is retained for as long as your account is active</li>
        <li>Session transcripts and progress data are retained indefinitely unless you request deletion</li>
        <li>Upon account deletion request, your personal data is deleted within 30 days</li>
        <li>Anonymised aggregate usage data may be retained for service improvement indefinitely</li>
      </UL>

      <H2>5. Your Rights Under the DPDP Act, 2023</H2>
      <P>Under India's Digital Personal Data Protection Act, 2023, you have the right to:</P>
      <UL>
        <li>
          <strong>Access:</strong> Request a summary of the personal data we hold about you
        </li>
        <li>
          <strong>Correction:</strong> Request correction of inaccurate data (most profile data can be updated directly in the app)
        </li>
        <li>
          <strong>Erasure:</strong> Request deletion of your account and associated personal data
        </li>
        <li>
          <strong>Withdraw Consent:</strong> Withdraw consent for data processing (this will require account closure)
        </li>
        <li>
          <strong>Grievance Redressal:</strong> Lodge a complaint with us or with the Data Protection Board of India
        </li>
        <li>
          <strong>Nomination:</strong> Nominate a person to exercise your rights in the event of death or incapacity
        </li>
      </UL>
      <P>
        To exercise any of these rights, email:{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
        . We will respond within 30 days as required by the DPDP Act.
      </P>

      <H2>6. Cookies</H2>
      <P>
        We use only essential session cookies required for authentication and secure login. We do not use advertising cookies, cross-site
        tracking cookies, or third-party analytics cookies.
      </P>

      <H2>7. Data Security</H2>
      <P>We implement the following security measures to protect your data:</P>
      <UL>
        <li>All data is transmitted over HTTPS (TLS encryption)</li>
        <li>Passwords are never stored — authentication uses Google OAuth or one-time passwords (OTP) only</li>
        <li>Session data is stored in a secure, server-side session store (PostgreSQL)</li>
        <li>Database is hosted on managed infrastructure with encryption at rest</li>
        <li>Admin access is restricted and requires separate credentials with IP logging</li>
      </UL>

      <H2>8. Children's Privacy</H2>
      <P>
        EduBharat is not intended for users under 18 years of age without parental or guardian consent. We do not knowingly collect data
        from children under 13. If you believe a child has provided us with personal information without consent, please contact us at{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
        .
      </P>

      <H2>9. International Data Transfers</H2>
      <P>
        Your data is primarily stored in India on Replit's infrastructure. AI processing involves API calls to Google and Anthropic servers,
        which may be located outside India. By using the Platform, you consent to this processing in accordance with the applicable data
        protection laws of those jurisdictions.
      </P>

      <H2>10. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy periodically. The updated date at the top of this page will reflect any changes. Continued use of
        the Platform after changes constitutes your acceptance of the revised policy.
      </P>

      <H2>11. Contact &amp; Grievance Officer</H2>
      <P>
        For privacy-related requests, questions, or complaints, contact our Privacy team at:
        <br />
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
      </P>
      <P>
        We are committed to responding to all privacy-related requests within 30 days, as required under the DPDP Act, 2023.
      </P>
    </div>
  );
}
