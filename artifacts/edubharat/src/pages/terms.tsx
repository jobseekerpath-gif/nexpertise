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

export default function Terms() {
  const email = useContent("legal.contact.email", "support@edubharat.in");
  const company = useContent("legal.company.name", "EduBharat");
  const jurisdiction = useContent("legal.jurisdiction", "Mumbai, Maharashtra, India");

  return (
    <div className="container mx-auto px-4 max-w-3xl py-10">
      <PageMeta
        title="Terms & Conditions · EduBharat"
        description="Terms and conditions for using EduBharat's AI-powered career learning platform."
      />
      <h1 className="text-3xl font-display font-bold text-secondary mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: July 2025</p>

      <H2>1. Acceptance of Terms</H2>
      <P>
        By accessing or using {company}'s platform ("the Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do
        not agree to these Terms, please do not use the Platform. These Terms constitute a legally binding agreement between you and {company}.
      </P>

      <H2>2. Description of Services</H2>
      <P>EduBharat provides AI-powered career development tools including:</P>
      <UL>
        <li>English Guru — Conversational AI for English fluency practice</li>
        <li>Interview Ace — Mock interview preparation with AI-generated feedback</li>
        <li>Rozgar Samachar — Live job listings and career news</li>
        <li>Resume Intelligence — AI-powered resume analysis and improvement</li>
        <li>My Journey — Personalised learning roadmap and skill tracking</li>
        <li>Tools Pro — AI productivity tools for cover letters, emails, and career content</li>
      </UL>

      <H2>3. Eligibility</H2>
      <P>
        You must be at least 18 years of age or have parental/guardian consent to use the Platform. By using the Platform, you represent that
        you meet these eligibility requirements and that you will provide accurate and complete registration information.
      </P>

      <H2>4. Credits and Payments</H2>
      <P>EduBharat uses a credit-based system for premium features. Key terms:</P>
      <UL>
        <li>1 credit = ₹1 (Indian Rupees)</li>
        <li>Credits are purchased via UPI (GPay, PhonePe, Paytm, or any UPI app)</li>
        <li>Credits do not expire and are non-transferable between accounts</li>
        <li>New users receive a signup credit bonus as a free trial</li>
        <li>Credits are consumed when using premium AI features such as Interview Ace and English Guru</li>
        <li>Paid credits may be refunded as per our Refund Policy; signup bonus credits are non-refundable</li>
      </UL>
      <P>
        Payment transactions are verified manually by EduBharat's team using your UPI Transaction Reference (UTR) number. Submitting
        fraudulent or incorrect UTR numbers may result in account suspension.
      </P>

      <H2>5. User Accounts</H2>
      <P>
        You are responsible for maintaining the confidentiality of your account credentials. You may not share your account with others or
        create multiple accounts for the same person. You are responsible for all activity under your account. Notify us immediately at{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>{" "}
        if you suspect unauthorized access.
      </P>

      <H2>6. Prohibited Uses</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the Platform for any unlawful purpose or in violation of these Terms</li>
        <li>Attempt to reverse-engineer, hack, or disrupt the Platform or its AI systems</li>
        <li>Submit false, misleading, or fraudulent payment information or UTR numbers</li>
        <li>Use AI-generated content for commercial resale without written authorisation from EduBharat</li>
        <li>Create accounts under false identities or on behalf of others without consent</li>
        <li>Use automated scripts, bots, or crawlers to access the Platform</li>
        <li>Harass, abuse, or threaten other users or our staff</li>
      </UL>

      <H2>7. Intellectual Property</H2>
      <P>
        All content, software, logos, designs, AI models, and interfaces on the Platform are the intellectual property of {company} or its
        licensors. You are granted a limited, non-exclusive, non-transferable licence to use the Platform for personal, non-commercial
        learning purposes only.
      </P>
      <P>
        AI-generated content produced during your sessions (interview feedback, learning content, resume suggestions) may be used by you for
        personal learning. Bulk reproduction or commercial use requires written permission from {company}.
      </P>

      <H2>8. AI-Generated Content Disclaimer</H2>
      <P>
        The Platform uses AI (Google Gemini and Anthropic Claude) to generate educational content, interview feedback, and career guidance.
        This content is provided for educational and informational purposes only and does not constitute professional legal, financial, or
        career advice. {company} does not guarantee employment outcomes or the accuracy of AI-generated assessments.
      </P>

      <H2>9. Limitation of Liability</H2>
      <P>The Platform is provided "as is" without warranties of any kind. To the maximum extent permitted by Indian law, {company} shall not be liable for:</P>
      <UL>
        <li>Indirect, incidental, special, or consequential damages</li>
        <li>Loss of data, revenue, or career opportunities</li>
        <li>Temporary service interruptions or AI model unavailability</li>
        <li>Career or business outcomes arising from AI-generated content</li>
      </UL>

      <H2>10. Privacy</H2>
      <P>
        Your use of the Platform is also governed by our{" "}
        <a href="/privacy-policy" className="text-primary hover:underline">
          Privacy Policy
        </a>
        , which is incorporated into these Terms by reference.
      </P>

      <H2>11. Governing Law and Jurisdiction</H2>
      <P>
        These Terms shall be governed by the laws of India, including the Information Technology Act, 2000, the Consumer Protection Act,
        2019, and the Digital Personal Data Protection Act, 2023. Any disputes arising out of these Terms shall be subject to the exclusive
        jurisdiction of courts in {jurisdiction}.
      </P>

      <H2>12. Changes to Terms</H2>
      <P>
        EduBharat reserves the right to modify these Terms at any time. Changes will be posted on this page with an updated date. Continued
        use of the Platform after changes constitutes your acceptance of the revised Terms.
      </P>

      <H2>13. Contact Us</H2>
      <P>
        For any questions about these Terms, please contact us at:{" "}
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
      </P>
    </div>
  );
}
