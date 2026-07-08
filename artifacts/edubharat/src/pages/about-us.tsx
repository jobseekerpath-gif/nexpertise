import { PageMeta } from "@/components/page-meta";
import { useContent } from "@/lib/use-content";
import { Link } from "wouter";
import { BookOpen, Mic, Newspaper, FileText, Route, Sparkles } from "lucide-react";

const TOOLS = [
  {
    icon: BookOpen,
    title: "English Guru",
    desc: "A conversational AI partner for practising spoken English. Choose your tutor, language, and level — and have real conversations anytime.",
  },
  {
    icon: Mic,
    title: "Interview Ace",
    desc: "Live AI mock interviews with competency-based scoring, per-question feedback, and a detailed performance report at the end.",
  },
  {
    icon: Newspaper,
    title: "Rozgar Samachar",
    desc: "Real-time job listings from across India, curated to your profile, experience level, and preferred city.",
  },
  {
    icon: FileText,
    title: "Resume Intelligence",
    desc: "AI-powered resume analysis — section-level scoring, ATS compatibility check, and specific improvement suggestions.",
  },
  {
    icon: Route,
    title: "My Journey",
    desc: "A personalised learning roadmap using spaced-repetition (SM-2) that adapts to your pace, mastery, and schedule.",
  },
  {
    icon: Sparkles,
    title: "Tools Pro",
    desc: "A suite of AI productivity tools for drafting cover letters, LinkedIn summaries, professional emails, and more.",
  },
];

const PILLARS = [
  {
    title: "Affordable",
    desc: "Credit-based pricing — pay only for what you use. No subscriptions, no lock-in. New users get free credits to try every tool.",
  },
  {
    title: "Multilingual",
    desc: "Practice in Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, and more — your language, your comfort.",
  },
  {
    title: "Privacy-first",
    desc: "Your data stays yours. No ads, no profiling, no selling of personal information — ever. You can delete your account anytime.",
  },
];

export default function AboutUs() {
  const mission = useContent(
    "about.mission",
    "We believe every young Indian, whether from a metro city or a small town, deserves access to world-class career preparation. EduBharat makes this possible through AI.",
  );

  return (
    <div className="container mx-auto px-4 max-w-4xl py-10">
      <PageMeta
        title="About Us · EduBharat"
        description="Learn about EduBharat's mission to empower India's youth with AI-driven career tools."
      />

      {/* Hero */}
      <div className="text-center mb-12">
        <p className="font-display font-bold text-4xl text-primary mb-4">EduBharat</p>
        <h1 className="text-2xl font-display font-bold text-secondary mb-4">Empowering India's Next Generation</h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">{mission}</p>
      </div>

      {/* Mission */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-secondary mb-3">Our Mission</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          India produces millions of graduates every year, but access to quality career coaching has always been limited to those who can
          afford expensive coaching centres or live in big cities. EduBharat changes this with AI-powered tools that give every learner a
          personal mentor — available 24/7, affordable, and in their language.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          From a student in Patna preparing for their first job interview, to a professional in Pune improving their English for a
          promotion — EduBharat is built for real India. Not a city. Not a demographic. Every Indian.
        </p>
      </section>

      {/* Tools */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-secondary mb-5">What We Offer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOOLS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="border border-border rounded-xl p-4 flex gap-3 hover:border-primary/30 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-secondary mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-secondary mb-3">Our Technology</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          EduBharat is powered by the world's most advanced AI — Google Gemini and Anthropic Claude — delivering responses that are
          contextual, personalised, and genuinely helpful for Indian career contexts. Our Text-to-Speech uses Microsoft Edge Neural TTS
          with Indian voices so the AI tutors sound natural and relatable.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Our spaced-repetition learning engine (based on the SM-2 algorithm) adapts to each student's pace and retention patterns,
          ensuring they practise what they need — not what they already know.
        </p>
      </section>

      {/* Pillars */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-secondary mb-4">Our Commitment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PILLARS.map(({ title, desc }) => (
            <div key={title} className="bg-muted/40 rounded-xl p-4">
              <h3 className="font-bold text-sm text-secondary mb-2">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="text-center pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground mb-3">
          Questions or feedback?{" "}
          <Link href="/contact-us" className="text-primary hover:underline font-medium">
            Contact us
          </Link>{" "}
          — we'd love to hear from you.
        </p>
        <p className="text-xs text-muted-foreground/60">Made with ❤️ in India 🇮🇳</p>
      </div>
    </div>
  );
}
