import { useState, useEffect } from "react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { Loader2, Newspaper, ChevronRight, RefreshCw, Languages } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function RozgarSamachar() {
  const chat = useAiChat();
  
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [article, setArticle] = useState<string>("");
  const [language, setLanguage] = useState("English");
  
  // Ref to track if we've already fetched on mount
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false);

  const fetchHeadlines = () => {
    chat.mutate({
      data: {
        prompt: `Generate 5 current career and job market news headlines relevant to the Indian market (e.g. SSC, UPSC, banking, tech sector hiring, private sector trends). Return ONLY a numbered list. Language: ${language}`,
        system: "You are an expert career journalist in India.",
      }
    }, {
      onSuccess: (res) => {
        const lines = res.text.split("\n").filter(l => l.trim().length > 0);
        const parsed = lines.map(l => l.replace(/^\d+\.\s*/, '').trim());
        setHeadlines(parsed.slice(0, 5));
        setSelectedTopic(null);
        setArticle("");
      }
    });
  };

  // Initial fetch
  useEffect(() => {
    if (!hasFetchedInitial) {
      setHasFetchedInitial(true);
      fetchHeadlines();
    }
  }, [hasFetchedInitial]); // only run once

  const fetchArticle = (topic: string) => {
    setSelectedTopic(topic);
    chat.mutate({
      data: {
        prompt: `Write a detailed, informative news article (around 300 words) about this headline: "${topic}". Write the article completely in ${language}. Use clear, professional language. Include subheadings if needed.`,
        system: "You are an expert career journalist writing an informative digest for job seekers.",
      }
    }, {
      onSuccess: (res) => setArticle(res.text)
    });
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setHeadlines([]);
    setSelectedTopic(null);
    setArticle("");
    // Re-fetch headlines in new language
    chat.mutate({
      data: {
        prompt: `Generate 5 current career and job market news headlines relevant to the Indian market. Return ONLY a numbered list. Language: ${lang}`,
        system: "You are an expert career journalist in India.",
      }
    }, {
      onSuccess: (res) => {
        const lines = res.text.split("\n").filter(l => l.trim().length > 0);
        const parsed = lines.map(l => l.replace(/^\d+\.\s*/, '').trim());
        setHeadlines(parsed.slice(0, 5));
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b pb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
            <Newspaper className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-secondary mb-1">Rozgar Samachar</h1>
            <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">
              Daily Career & Jobs Digest
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Languages className="w-5 h-5 text-muted-foreground" />
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full md:w-[180px] font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Sidebar - Headlines */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold">Today's Headlines</h2>
            <Button variant="ghost" size="icon" onClick={fetchHeadlines} disabled={chat.isPending} title="Refresh Headlines">
              <RefreshCw className={`w-4 h-4 ${chat.isPending && !selectedTopic ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {headlines.length === 0 && chat.isPending && !selectedTopic ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {headlines.map((headline, idx) => (
                <button
                  key={idx}
                  onClick={() => fetchArticle(headline)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                    selectedTopic === headline 
                      ? "bg-primary text-primary-foreground border-primary shadow-md" 
                      : "bg-card hover:bg-muted hover:border-primary/30"
                  }`}
                  data-testid={`headline-button-${idx}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-sm leading-snug line-clamp-3">
                      {headline}
                    </span>
                    <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 ${selectedTopic === headline ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content - Article */}
        <div className="lg:col-span-8">
          <Card className="min-h-[500px] border-none shadow-xl bg-card/50">
            <CardContent className="p-8 md:p-12">
              {!selectedTopic && !chat.isPending ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-4 py-20">
                  <Newspaper className="w-16 h-16 opacity-20" />
                  <p className="text-lg">Select a headline from the left to read the full article.</p>
                </div>
              ) : chat.isPending && selectedTopic ? (
                <div className="space-y-6">
                  <div className="h-10 bg-muted animate-pulse rounded-md w-3/4 mb-8" />
                  <div className="space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded-md w-11/12" />
                    <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded-md w-10/12" />
                    <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-3xl font-display font-extrabold text-secondary mb-8 leading-tight">
                    {selectedTopic}
                  </h2>
                  <div className="prose prose-lg max-w-none text-secondary/80 leading-relaxed whitespace-pre-wrap">
                    {article}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
