import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Newspaper, ArrowRight, Sparkles, CheckCircle2, Star,
  MessageCircle, Wrench, Map, Mic, FileText, TrendingUp, Building2,
} from "lucide-react";
import { TUTORS } from "@/lib/tutors";
import { HomeMeta } from "@/components/page-meta";
import { useContent } from "@/lib/use-content";

const FEATURED_TUTORS = TUTORS.slice(0, 3);

const PROOF_POINTS = [
  "Native-language support — Hindi, Tamil, Telugu & 10 more",
  "Voice-powered practice — speak, listen, improve",
  "Live jobs personalised by experience & location",
  "CEFR English roadmap from A1 to C2",
];

const FLUENCY_TOOLS = [
  { icon: MessageCircle, title: "English Guru",  desc: "6 AI tutors · live conversation · 12+ Indian languages", href: "/english-guru"     },
  { icon: Wrench,         title: "Tools Pro",     desc: "Grammar Fix · Write Better · Vocabulary · Pronunciation", href: "/tools-pro"       },
  { icon: Map,            title: "My Journey",    desc: "CEFR roadmap A1→C2 · spaced repetition · mastery badges", href: "/learning-journey" },
];

const CAREER_TOOLS = [
  { icon: Mic,      title: "Interview Ace",    desc: "12 interview types · AI feedback · voice practice",        href: "/interview-ace"       },
  { icon: Newspaper,title: "Rozgar Samachar",  desc: "Live job feed · salary insights · career news from India", href: "/rozgar-samachar"     },
  { icon: FileText, title: "Resume",           desc: "ATS score · keyword gaps · 3 actionable improvements",     href: "/resume-intelligence"  },
];

export default function Home() {
  const heroBadge    = useContent("home.hero.badge",       "AI-powered career platform for India");
  const heroSubtitle = useContent("home.hero.subtitle",    "EduBharat gives every Indian learner a personal AI mentor — for spoken English, mock interviews, and live career updates.");
  const ctaPrimary   = useContent("home.hero.ctaPrimary",  "Start Learning Free");
  const ctaSecondary = useContent("home.hero.ctaSecondary","Browse Jobs");

  return (
    <>
      <HomeMeta />
      <div className="flex flex-col w-full">

        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-background pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-background to-blue-50 pointer-events-none" />
          <div className="container mx-auto px-4 relative">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">

              {/* Left copy */}
              <div className="max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5 border border-primary/20">
                  <Sparkles className="w-4 h-4" />
                  <span>{heroBadge}</span>
                </div>
                <h1 className="max-w-xl text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-secondary mb-5 leading-[1.05]">
                  Master English.<br />
                  Ace Interviews.<br />
                  <span className="text-primary">Get the Job.</span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed max-w-xl">
                  {heroSubtitle}
                </p>
                <ul className="space-y-2 mb-8">
                  {PROOF_POINTS.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-secondary">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <Link href="/english-guru">
                    <Button size="lg" className="h-12 px-7 text-base font-bold shadow-lg shadow-primary/20">
                      {ctaPrimary}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/rozgar-samachar">
                    <Button size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                      {ctaSecondary}
                    </Button>
                  </Link>
                </div>
                {/* Recruiter portal nudge */}
                <Link
                  href="/b2b/login"
                  className="inline-flex items-center gap-2 mt-1 text-sm text-muted-foreground hover:text-violet-700 transition-colors group"
                >
                  <Building2 className="w-4 h-4 group-hover:text-violet-600 transition-colors" />
                  Are you a recruiter?
                  <span className="font-semibold text-violet-600 group-hover:underline">
                    Open Recruiter Portal →
                  </span>
                </Link>
              </div>

              {/* Right — AI teacher showcase */}
              <div className="relative animate-in slide-in-from-right-8 duration-1000 delay-150">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-blue-100/60 rounded-[2.5rem] blur-3xl pointer-events-none" />
                <div className="relative rounded-[2rem] border bg-card shadow-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meet Your AI Teachers</p>
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1 text-yellow-500" />
                      AI-Powered
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {FEATURED_TUTORS.map(tutor => (
                      <Link key={tutor.id} href="/english-guru" className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50 cursor-pointer">
                        <div className="relative">
                          <img
                            src={tutor.imageSrc} alt={tutor.name} width={64} height={64}
                            className="w-16 h-16 rounded-full object-cover object-top border-2 border-white shadow-md"
                            loading="lazy" decoding="async"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-extrabold rounded-full px-1 py-0.5 leading-none border border-white">AI</span>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-secondary leading-tight">{tutor.name}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{tutor.role}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-center text-muted-foreground">+ 3 more AI teachers — choose who teaches you</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Tutors",     value: "6 AI"  },
                      { label: "Languages",  value: "12+"   },
                      { label: "Job Sources",value: "Live"  },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl border bg-muted/30 p-3 text-center">
                        <p className="text-xs font-bold text-secondary">{card.value}</p>
                        <p className="text-[10px] text-muted-foreground">{card.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Two Product Suites ──────────────────────────────────────────────── */}
        <section className="py-16 sm:py-20 bg-muted/40">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-secondary mb-4">
                Two focused suites. One platform.
              </h2>
              <p className="text-lg text-muted-foreground">
                Mastering English and growing your career — built for every Indian learner.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">

              {/* ── Fluency Suite ─────────────────────────── */}
              <div className="rounded-3xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-amber-50/50 to-background p-7 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full border border-orange-200/60">
                      Fluency Suite
                    </span>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-secondary leading-tight mb-2">
                    Speak English with confidence.<br />
                    <span className="text-orange-600">Learn in your own language.</span>
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Practice naturally with native-language support in Hindi, Tamil, Telugu and 10 more Indian languages.
                    Track your CEFR progress from A1 to C2 and build lasting fluency through daily habit.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {FLUENCY_TOOLS.map(({ icon: Icon, title, desc, href }) => (
                    <Link key={title} href={href} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-orange-100 hover:border-orange-200 transition-all group cursor-pointer">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-secondary">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>

                <Link href="/english-guru">
                  <Button className="w-full h-11 font-bold bg-orange-500 hover:bg-orange-600 text-white text-sm">
                    Start English Journey
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* ── Career Suite ──────────────────────────── */}
              <div className="rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-background p-7 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200/60">
                      Career Suite
                    </span>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-secondary leading-tight mb-2">
                    Get interview-ready.<br />
                    <span className="text-blue-600">Land the right job.</span>
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Everything personalised to your age, experience and location — from mock interview coaching
                    and AI feedback to live job feeds and resume optimisation for the Indian job market.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {CAREER_TOOLS.map(({ icon: Icon, title, desc, href }) => (
                    <Link key={title} href={href} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-blue-100 hover:border-blue-200 transition-all group cursor-pointer">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-secondary">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>

                <Link href="/interview-ace">
                  <Button className="w-full h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    Start Interview Prep
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Teacher Gallery ──────────────────────────────────────────────── */}
        <section className="py-12 bg-background border-t">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-secondary mb-2">Your AI Teaching Team</h2>
              <p className="text-muted-foreground text-sm">Each teacher specialises in a different aspect of English and career development</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {TUTORS.map((tutor, idx) => (
                <Link key={tutor.id} href="/english-guru">
                  <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                    <div className="relative">
                      <img
                        src={tutor.imageSrc} alt={tutor.name} width={80} height={80}
                        className="w-20 h-20 rounded-full object-cover object-top border-3 shadow-md group-hover:border-primary/60 transition-colors"
                        style={{ border: `3px solid ${tutor.accentColor}30` }}
                        loading={idx < 3 ? "eager" : "lazy"} decoding="async"
                      />
                      <span
                        className="absolute -bottom-1 -right-1 text-white text-[8px] font-extrabold rounded-full px-1.5 py-0.5 leading-none shadow-sm"
                        style={{ backgroundColor: tutor.accentColor }}
                      >AI</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-secondary leading-tight">{tutor.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{tutor.role}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/english-guru">
                <Button className="font-bold px-8">
                  Choose Your Teacher
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
