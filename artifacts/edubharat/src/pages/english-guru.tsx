import { useState } from "react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { Loader2, BookOpen, PenLine, Languages, SpellCheck } from "lucide-react";

export default function EnglishGuru() {
  const chat = useAiChat();
  
  // Grammar Fix State
  const [grammarText, setGrammarText] = useState("");
  const [grammarResult, setGrammarResult] = useState("");

  // Write Better State
  const [writeText, setWriteText] = useState("");
  const [writeResult, setWriteResult] = useState("");

  // Vocabulary State
  const [vocabTopic, setVocabTopic] = useState("");
  const [vocabLanguage, setVocabLanguage] = useState("Hindi");
  const [vocabResult, setVocabResult] = useState("");

  // Translation State
  const [translateText, setTranslateText] = useState("");
  const [translateLang, setTranslateLang] = useState("Hindi");
  const [translateResult, setTranslateResult] = useState("");

  const handleGrammarFix = () => {
    if (!grammarText.trim()) return;
    chat.mutate({
      data: {
        prompt: `Fix the grammar in the following text and explain the corrections clearly and simply: "${grammarText}"`,
        system: "You are an encouraging English teacher helping an Indian student. Explain grammar rules simply.",
      }
    }, {
      onSuccess: (res) => setGrammarResult(res.text)
    });
  };

  const handleWriteBetter = () => {
    if (!writeText.trim()) return;
    chat.mutate({
      data: {
        prompt: `Improve the following text to make it sound more professional and natural: "${writeText}"`,
        system: "You are a professional writing coach. Provide the improved version and briefly explain why it's better.",
      }
    }, {
      onSuccess: (res) => setWriteResult(res.text)
    });
  };

  const handleVocabulary = () => {
    if (!vocabTopic.trim()) return;
    chat.mutate({
      data: {
        prompt: `Generate 5 useful English vocabulary words related to "${vocabTopic}". For each word, provide the meaning in English, the meaning in ${vocabLanguage}, and an example sentence.`,
        system: `You are an English teacher for Indian students. Provide clear, everyday vocabulary. Format clearly.`,
      }
    }, {
      onSuccess: (res) => setVocabResult(res.text)
    });
  };

  const handleTranslation = () => {
    if (!translateText.trim()) return;
    chat.mutate({
      data: {
        prompt: `Translate the following text into ${translateLang}. Provide the translation, and if the original text was not English, also provide the English translation: "${translateText}"`,
        system: "You are an expert translator specializing in Indian languages.",
      }
    }, {
      onSuccess: (res) => setTranslateResult(res.text)
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-display font-bold text-secondary mb-4">English Guru</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Your personal AI English teacher. Practice writing, fix grammar mistakes, build your vocabulary, and translate text instantly.
        </p>
      </div>

      <Tabs defaultValue="grammar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 mb-8">
          <TabsTrigger value="grammar" className="py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <SpellCheck className="w-4 h-4 mr-2" />
            Grammar Fix
          </TabsTrigger>
          <TabsTrigger value="write" className="py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <PenLine className="w-4 h-4 mr-2" />
            Write Better
          </TabsTrigger>
          <TabsTrigger value="vocab" className="py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BookOpen className="w-4 h-4 mr-2" />
            Vocabulary
          </TabsTrigger>
          <TabsTrigger value="translate" className="py-3 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Languages className="w-4 h-4 mr-2" />
            Translation
          </TabsTrigger>
        </TabsList>

        {/* Grammar Fix */}
        <TabsContent value="grammar" className="space-y-6 animate-in fade-in duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Fix Grammar Mistakes</CardTitle>
              <CardDescription>Paste your English text here, and the AI will correct it and explain why.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Type or paste your text here..." 
                className="min-h-[150px] resize-y text-base"
                value={grammarText}
                onChange={(e) => setGrammarText(e.target.value)}
                data-testid="input-grammar"
              />
              <Button onClick={handleGrammarFix} disabled={chat.isPending || !grammarText.trim()} className="w-full md:w-auto font-bold" data-testid="button-grammar-fix">
                {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SpellCheck className="w-4 h-4 mr-2" />}
                Correct My Grammar
              </Button>

              {grammarResult && (
                <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20">
                  <h3 className="font-bold text-primary mb-3">Teacher's Feedback:</h3>
                  <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">
                    {grammarResult}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Write Better */}
        <TabsContent value="write" className="space-y-6 animate-in fade-in duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Improve Your Writing</CardTitle>
              <CardDescription>Make your emails, essays, or messages sound more professional and natural.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Type your draft here..." 
                className="min-h-[150px] resize-y text-base"
                value={writeText}
                onChange={(e) => setWriteText(e.target.value)}
                data-testid="input-write"
              />
              <Button onClick={handleWriteBetter} disabled={chat.isPending || !writeText.trim()} className="w-full md:w-auto font-bold" data-testid="button-write-better">
                {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
                Improve Writing
              </Button>

              {writeResult && (
                <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20">
                  <h3 className="font-bold text-primary mb-3">Improved Version:</h3>
                  <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">
                    {writeResult}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vocabulary */}
        <TabsContent value="vocab" className="space-y-6 animate-in fade-in duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Build Vocabulary</CardTitle>
              <CardDescription>Get 5 new words related to any topic with meanings and examples in your language.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    placeholder="Enter a topic (e.g., Job Interview, Business, Weather)" 
                    value={vocabTopic}
                    onChange={(e) => setVocabTopic(e.target.value)}
                    className="text-base h-11"
                    data-testid="input-vocab-topic"
                  />
                </div>
                <Select value={vocabLanguage} onValueChange={setVocabLanguage}>
                  <SelectTrigger className="w-full md:w-[200px] h-11">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_LANGUAGES.map(lang => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleVocabulary} disabled={chat.isPending || !vocabTopic.trim()} className="w-full md:w-auto font-bold" data-testid="button-vocab">
                {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                Learn New Words
              </Button>

              {vocabResult && (
                <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20">
                  <h3 className="font-bold text-primary mb-3">Vocabulary List:</h3>
                  <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">
                    {vocabResult}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Translation */}
        <TabsContent value="translate" className="space-y-6 animate-in fade-in duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Translate Text</CardTitle>
              <CardDescription>Translate between English and 12 Indian languages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mb-2">
                <Select value={translateLang} onValueChange={setTranslateLang}>
                  <SelectTrigger className="w-full md:w-[250px] h-11">
                    <SelectValue placeholder="Translate to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_LANGUAGES.map(lang => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea 
                placeholder="Enter text to translate..." 
                className="min-h-[120px] resize-y text-base"
                value={translateText}
                onChange={(e) => setTranslateText(e.target.value)}
                data-testid="input-translate"
              />
              
              <Button onClick={handleTranslation} disabled={chat.isPending || !translateText.trim()} className="w-full md:w-auto font-bold" data-testid="button-translate">
                {chat.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Languages className="w-4 h-4 mr-2" />}
                Translate Text
              </Button>

              {translateResult && (
                <div className="mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20">
                  <h3 className="font-bold text-primary mb-3">Translation:</h3>
                  <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap text-lg">
                    {translateResult}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
