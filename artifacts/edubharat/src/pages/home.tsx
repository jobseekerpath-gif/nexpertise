import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Briefcase, Newspaper, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-14 pb-20 lg:pt-20 lg:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5">
                <Sparkles className="w-4 h-4" />
                <span>AI learning for English, interviews, and jobs</span>
              </div>
              <h1 className="max-w-xl text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-secondary mb-5 leading-[1.05]">
                Master English. <br/>
                Ace Interviews. <br/>
                <span className="text-primary">Get the Job.</span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-7 leading-relaxed max-w-xl">
                EduBharat is your friendly AI mentor for English practice, mock interviews, and live career updates — designed for Indian learners.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {["English practice", "Interview coaching", "Live job feed"].map(item => (
                  <span key={item} className="rounded-full border bg-white px-4 py-2 text-sm font-semibold text-secondary shadow-sm">
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/english-guru">
                  <Button size="lg" className="h-14 px-8 text-base font-bold shadow-lg shadow-primary/20">
                    Start Learning
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative animate-in slide-in-from-right-8 duration-1000 delay-150">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-transparent to-blue-100 rounded-[2.5rem] blur-3xl" />
              <div className="relative rounded-[2rem] border bg-card shadow-2xl p-4 sm:p-5">
                <img 
                  src="/images/hero-illustration.png" 
                  alt="Indian students studying with AI" 
                  className="rounded-[1.5rem] shadow-sm border bg-card w-full object-cover aspect-[4/3] object-center"
                />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "English Guru", value: "Live voice" },
                    { label: "Interview Ace", value: "Auto mic" },
                    { label: "Rozgar", value: "Real jobs" },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                      <p className="mt-1 text-sm font-semibold text-secondary">{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-secondary mb-4">Three tools. One career platform.</h2>
            <p className="text-lg text-muted-foreground">Everything is laid out to feel clearer, faster, and easier to use on one screen.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 rounded-3xl overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">English Guru</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Your personal AI English teacher. Practice speaking, fix grammar, and build confidence with Indian-language support.
                </p>
                <Link href="/english-guru">
                  <Button variant="outline" className="w-full font-semibold group">
                    Practice English
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 delay-75 rounded-3xl overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <Briefcase className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">Interview Ace</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Mock interview coach tailored to your role and experience. Get realistic questions, voice practice, and instant feedback.
                </p>
                <Link href="/interview-ace">
                  <Button variant="outline" className="w-full font-semibold group">
                    Start Mock Interview
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 delay-150 rounded-3xl overflow-hidden">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Newspaper className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">Rozgar Samachar</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Daily career newspaper with real live jobs, salary insights, and practical career updates for India.
                </p>
                <Link href="/rozgar-samachar">
                  <Button variant="outline" className="w-full font-semibold group">
                    Read Daily News
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
