import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Briefcase, Newspaper, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl animate-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Learning for Bharat</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-extrabold tracking-tight text-secondary mb-6 leading-[1.1]">
                Master English. <br/>
                Ace Interviews. <br/>
                <span className="text-primary">Get the Job.</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
                EduBharat is your friendly AI mentor. Whether you're preparing for government exams or stepping into the corporate world, we speak your language.
              </p>
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
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-[2.5rem] blur-3xl" />
              <img 
                src="/images/hero-illustration.png" 
                alt="Indian students studying with AI" 
                className="relative rounded-[2.5rem] shadow-2xl border bg-card w-full object-cover aspect-video lg:aspect-square object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-secondary mb-4">Three powerful tools. One platform.</h2>
            <p className="text-lg text-muted-foreground">Everything you need to accelerate your career, powered by advanced AI.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">English Guru</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Your personal AI English teacher. Fix grammar, improve your writing, build vocabulary, and translate from 12 Indian languages.
                </p>
                <Link href="/english-guru">
                  <Button variant="outline" className="w-full font-semibold group">
                    Practice English
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 delay-75">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <Briefcase className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">Interview Ace</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Mock interview coach tailored to your exact role and experience. Get realistic questions and instant feedback on your answers.
                </p>
                <Link href="/interview-ace">
                  <Button variant="outline" className="w-full font-semibold group">
                    Start Mock Interview
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 delay-150">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Newspaper className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3 text-secondary">Rozgar Samachar</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Daily AI-generated newspaper covering the latest jobs and career trends in India. Read deep-dives in your regional language.
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
