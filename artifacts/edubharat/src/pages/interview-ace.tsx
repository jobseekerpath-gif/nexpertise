import { useState } from "react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { Loader2, PlayCircle, Send, Lightbulb } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const JOB_ROLES = [
  "Software Developer", "Data Analyst", "Marketing Manager", "Sales Executive", 
  "HR Manager", "Teacher", "Bank PO", "IAS/IPS Officer", "Nurse", "CA/Accountant"
];

const EXPERIENCES = ["Fresher", "1-3 years", "3-5 years", "5+ years"];

type Question = {
  text: string;
  answer?: string;
  feedback?: string;
};

export default function InterviewAce() {
  const chat = useAiChat();
  
  const [role, setRole] = useState(JOB_ROLES[0]);
  const [experience, setExperience] = useState(EXPERIENCES[0]);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  
  const [tipsLang, setTipsLang] = useState("Hindi");
  const [tips, setTips] = useState("");

  const handleStartSession = () => {
    chat.mutate({
      data: {
        prompt: `Generate 5 realistic and specific interview questions for a ${role} with ${experience} of experience. Return ONLY a numbered list of questions.`,
        system: "You are an expert HR interviewer in India. Give exactly 5 direct questions.",
      }
    }, {
      onSuccess: (res) => {
        // Parse the list into an array
        const lines = res.text.split("\n").filter(l => l.trim().length > 0);
        // Strip numbers from beginning
        const parsed = lines.map(l => ({ text: l.replace(/^\d+\.\s*/, '').trim() }));
        setQuestions(parsed.slice(0, 5));
        setCurrentQIndex(0);
        setCurrentAnswer("");
      }
    });
  };

  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return;
    
    const question = questions[currentQIndex].text;
    
    chat.mutate({
      data: {
        prompt: `Question: "${question}"\nCandidate Answer: "${currentAnswer}"\n\nEvaluate this answer. Provide a rating out of 10, strengths, and areas for improvement. Be constructive but honest.`,
        system: `You are an expert technical and HR interviewer for the role of ${role}.`,
      }
    }, {
      onSuccess: (res) => {
        const newQs = [...questions];
        newQs[currentQIndex].answer = currentAnswer;
        newQs[currentQIndex].feedback = res.text;
        setQuestions(newQs);
        setCurrentAnswer("");
      }
    });
  };

  const handleNextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    }
  };

  const handleGetTips = () => {
    chat.mutate({
      data: {
        prompt: `Give 5 essential interview tips for a ${role} candidate in India. Write the response in ${tipsLang}.`,
        system: "You are an encouraging career mentor.",
      }
    }, {
      onSuccess: (res) => setTips(res.text)
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <PlayCircle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-display font-bold text-secondary mb-4">Interview Ace</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Practice mock interviews for your dream job. Get instant feedback, ratings, and expert tips to ace the real thing.
        </p>
      </div>

      {questions.length === 0 ? (
        <Card className="max-w-xl mx-auto border-none shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Start a Practice Session</CardTitle>
            <CardDescription>Tell us about the role you're aiming for.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Job Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-12" data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Experience Level</label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="h-12" data-testid="select-experience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              size="lg" 
              className="w-full font-bold text-base h-12 shadow-md shadow-primary/20" 
              onClick={handleStartSession}
              disabled={chat.isPending}
              data-testid="button-start-interview"
            >
              {chat.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <PlayCircle className="w-5 h-5 mr-2" />}
              Generate Interview Questions
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {role} • {experience}
            </div>
            <div className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Question {currentQIndex + 1} of {questions.length}
            </div>
          </div>

          <Card className="border-none shadow-lg">
            <CardContent className="p-8">
              <h2 className="text-2xl font-display font-bold text-secondary mb-6 leading-relaxed">
                {questions[currentQIndex].text}
              </h2>
              
              {!questions[currentQIndex].feedback ? (
                <div className="space-y-4">
                  <Textarea 
                    placeholder="Type your answer here as if you are speaking in an interview..."
                    className="min-h-[200px] text-base p-4 bg-muted/50 border-muted-foreground/20 focus-visible:bg-background"
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    data-testid="input-answer"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSubmitAnswer} 
                      disabled={!currentAnswer.trim() || chat.isPending}
                      className="font-bold px-6"
                      data-testid="button-submit-answer"
                    >
                      {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Submit Answer for Feedback
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Your Answer:</span>
                    <p className="text-secondary">{questions[currentQIndex].answer}</p>
                  </div>
                  
                  <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
                    <span className="text-sm font-bold text-green-700 uppercase tracking-wider mb-3 block">AI Feedback:</span>
                    <div className="prose prose-sm max-w-none text-green-950 whitespace-pre-wrap">
                      {questions[currentQIndex].feedback}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    {currentQIndex < questions.length - 1 ? (
                      <Button onClick={handleNextQuestion} size="lg" className="font-bold">
                        Next Question <PlayCircle className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button onClick={() => setQuestions([])} variant="outline" size="lg" className="font-bold">
                        Start New Session
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Separator className="my-16" />

      <Card className="bg-secondary text-secondary-foreground border-none shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Lightbulb className="w-32 h-32" />
        </div>
        <CardHeader className="relative z-10">
          <CardTitle className="text-2xl text-white">Interview Tips in Your Language</CardTitle>
          <CardDescription className="text-secondary-foreground/70">Get expert advice tailored to your role, explained clearly.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={tipsLang} onValueChange={setTipsLang}>
              <SelectTrigger className="w-full sm:w-[200px] bg-secondary-foreground/10 border-secondary-foreground/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleGetTips} disabled={chat.isPending} className="bg-primary hover:bg-primary/90 text-white font-bold" data-testid="button-get-tips">
              {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
              Get Tips
            </Button>
          </div>

          {tips && (
            <div className="p-6 bg-secondary-foreground/5 rounded-xl border border-secondary-foreground/10 animate-in fade-in">
              <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                {tips}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
