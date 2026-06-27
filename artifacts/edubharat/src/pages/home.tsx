import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Briefcase, Newspaper, ArrowRight, Sparkles, CheckCircle2, Star } from "lucide-react";
import { TUTORS } from "@/lib/tutors";
import { HomeMeta } from "@/components/page-meta";

const FEATURED_TUTORS = TUTORS.slice(0, 3);

const FEATURES = [
  {
    icon: BookOpen,
    color: "bg-orange-100 text-orange-600",
    title: "English Guru",
    desc: "Your personal AI English teacher. Practice speaking, fix grammar, and build confidence — with support in Hindi and 11 Indian languages.",
    href: "/english-guru",
    cta: "Practice English",
    badge: "6 AI Teachers",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    icon: Briefcase,
    color: "bg-blue-100 text-blue-600",
    title: "Interview Ace",
    desc: "Mock interview coach tailored to your role and experience. Get realistic questions, voice practice, and instant AI feedback from Raj Sir.",
    href: "/interview-ace",
    cta: "Start Mock Interview",
    badge: "12 Interview Types",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    icon: Newspaper,
    color: "bg-purple-100 text-purple-600",
    title: "Rozgar Samachar",
    desc: "Daily career newspaper with live jobs, salary insights, and practical updates from across India — personalised to your profile.",
    href: "/rozgar-samachar",
    cta: "Read Daily News",
    badge: "Live Job Feed",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

const PROOF_POINTS = [
  "Indian-language support — Hindi, Tamil, Telugu & more",
  "Voice-powered practice — speak, listen, improve",
  "Live job data from official career pages",
  "Personalized to your level and career goal",
];

export default function Home() {
  return (
    <>
      <HomeMeta />
      <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden bg-background pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-background to-blue-50 pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left copy */}
            <div className="max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>AI-powered career platform for India</span>
              </div>
              <h1 className="max-w-xl text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-secondary mb-5 leading-[1.05]">
                Master English.<br />
                Ace Interviews.<br />
                <span className="text-primary">Get the Job.</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed max-w-xl">
                EduBharat gives every Indian learner a personal AI mentor — for spoken English, mock interviews, and live career updates.
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
                    Start Learning Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/rozgar-samachar">
                  <Button size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                    Browse Jobs
                  </Button>
                </Link>
              </div>
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
                          src={tutor.imageSrc}
                          alt={tutor.name}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-full object-cover object-top border-2 border-white shadow-md"
                          loading="lazy"
                          decoding="async"
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
                <p className="text-xs text-center text-muted-foreground">
                  + 3 more AI teachers — choose who teaches you
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Tutors", value: "6 AI" },
                    { label: "Languages", value: "12+" },
                    { label: "Job Sources", value: "Live" },
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

      {/* Features */}
      <section className="py-16 sm:py-20 bg-muted/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-secondary mb-4">Three tools. One career platform.</h2>
            <p className="text-lg text-muted-foreground">Built for Indian learners — real AI, real data, real results.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Card key={f.title} className={`border shadow-lg hover:-translate-y-1 transition-transform duration-300 rounded-2xl overflow-hidden ${i === 1 ? "md:-mt-2 md:shadow-2xl" : ""}`}>
                <CardContent className="p-7">
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center`}>
                      <f.icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-bold border rounded-full px-2.5 py-1 ${f.badgeColor}`}>{f.badge}</span>
                  </div>
                  <h3 className="text-xl font-display font-bold mb-2 text-secondary">{f.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed text-sm">{f.desc}</p>
                  <Link href={f.href}>
                    <Button variant="outline" className="w-full font-semibold group text-sm">
                      {f.cta}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Teacher gallery strip */}
      <section className="py-12 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-bold text-secondary mb-2">Your AI Teaching Team</h2>
            <p className="text-muted-foreground text-sm">Each teacher specializes in a different aspect of English and career development</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {TUTORS.map((tutor, idx) => (
              <Link key={tutor.id} href="/english-guru">
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                  <div className="relative">
                    <img
                      src={tutor.imageSrc}
                      alt={tutor.name}
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-full object-cover object-top border-3 shadow-md group-hover:border-primary/60 transition-colors"
                      style={{ border: `3px solid ${tutor.accentColor}30` }}
                      loading={idx < 3 ? "eager" : "lazy"}
                      decoding="async"
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
