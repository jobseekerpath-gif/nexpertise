import { useState } from "react";
import { useAiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useHistory } from "@/lib/use-history";
import { Loader2, BookOpen, PenLine, Languages, SpellCheck, Bookmark, BookmarkCheck } from "lucide-react";

const MODES = [
  { value: "grammar", label: "Grammar Fix", icon: SpellCheck },
  { value: "write", label: "Write Better", icon: PenLine },
  { value: "vocab", label: "Vocabulary", icon: BookOpen },
  { value: "translate", label: "Translation", icon: Languages },
] as const;

type Mode = typeof MODES[number]["value"];

function SaveButton({ title, content, onSave }: { title: string; content: string; onSave: () => void }) {
  const [saved, setSaved] = useState(false);
  const handleClick = () => {
    if (saved) return;
    onSave();
    setSaved(true);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={saved}
      className="text-xs font-semibold"
      data-testid="button-save-response"
    >
      {saved ? (
        <><BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />Saved</>
      ) : (
        <><Bookmark className="w-3.5 h-3.5 mr-1.5" />Save</>
      )}
    </Button>
  );
}

export default function EnglishGuru() {
  const chat = useAiChat();
  const { save } = useHistory();

  const [mode, setMode] = useState<Mode>("grammar");

  const [grammarText, setGrammarText] = useState("");
  const [grammarResult, setGrammarResult] = useState("");

  const [writeText, setWriteText] = useState("");
  const [writeResult, setWriteResult] = useState("");

  const [vocabTopic, setVocabTopic] = useState("");
  const [vocabLanguage, setVocabLanguage] = useState("Hindi");
  const [vocabResult, setVocabResult] = useState("");

  const [translateText, setTranslateText] = useState("");
  const [translateLang, setTranslateLang] = useState("Hindi");
  const [translateResult, setTranslateResult] = useState("");

  const handleGrammarFix = () => {
    if (!grammarText.trim()) return;
    setGrammarResult("");
    chat.mutate({
      data: {
        prompt: `Fix the grammar in the following text and explain the corrections clearly and simply: "${grammarText}"`,
        system: "You are an encouraging English teacher helping an Indian student. Explain grammar rules simply.",
      }
    }, { onSuccess: (res) => setGrammarResult(res.text) });
  };

  const handleWriteBetter = () => {
    if (!writeText.trim()) return;
    setWriteResult("");
    chat.mutate({
      data: {
        prompt: `Improve the following text to make it sound more professional and natural: "${writeText}"`,
        system: "You are a professional writing coach. Provide the improved version and briefly explain why it's better.",
      }
    }, { onSuccess: (res) => setWriteResult(res.text) });
  };

  const handleVocabulary = () => {
    if (!vocabTopic.trim()) return;
    setVocabResult("");
    chat.mutate({
      data: {
        prompt: `Generate 5 useful English vocabulary words related to "${vocabTopic}". For each word, provide the meaning in English, the meaning in ${vocabLanguage}, and an example sentence.`,
        system: `You are an English teacher for Indian students. Provide clear, everyday vocabulary. Format clearly.`,
      }
    }, { onSuccess: (res) => setVocabResult(res.text) });
  };

  const handleTranslation = () => {
    if (!translateText.trim()) return;
    setTranslateResult("");
    chat.mutate({
      data: {
        prompt: `Translate the following text into ${translateLang}. Provide the translation, and if the original text was not English, also provide the English translation: "${translateText}"`,
        system: "You are an expert translator specializing in Indian languages.",
      }
    }, { onSuccess: (res) => setTranslateResult(res.text) });
  };

  const currentMode = MODES.find(m => m.value === mode)!;
  const Icon = currentMode.icon;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-display font-bold text-secondary mb-4">English Guru</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Your personal AI English teacher. Practice writing, fix grammar mistakes, build your vocabulary, and translate text instantly.
        </p>
      </div>

      <div className="mb-8 flex items-center gap-3 max-w-xs">
        <Icon className="w-5 h-5 text-primary shrink-0" />
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-11 font-semibold" data-testid="select-mode">
            <SelectValue placeholder="Select a feature" />
          </SelectTrigger>
          <SelectContent>
            {MODES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "grammar" && (
        <Card className="animate-in fade-in duration-300">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-primary">Teacher's Feedback:</h3>
                  <SaveButton
                    title={`Grammar Fix: "${grammarText.slice(0, 50)}${grammarText.length > 50 ? "…" : ""}"`}
                    content={grammarResult}
                    onSave={() => save({ tool: "English Guru", title: `Grammar Fix: "${grammarText.slice(0, 50)}${grammarText.length > 50 ? "…" : ""}"`, content: grammarResult })}
                  />
                </div>
                <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">{grammarResult}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "write" && (
        <Card className="animate-in fade-in duration-300">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-primary">Improved Version:</h3>
                  <SaveButton
                    title={`Write Better: "${writeText.slice(0, 50)}${writeText.length > 50 ? "…" : ""}"`}
                    content={writeResult}
                    onSave={() => save({ tool: "English Guru", title: `Write Better: "${writeText.slice(0, 50)}${writeText.length > 50 ? "…" : ""}"`, content: writeResult })}
                  />
                </div>
                <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">{writeResult}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "vocab" && (
        <Card className="animate-in fade-in duration-300">
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
                <SelectTrigger className="w-full md:w-[200px] h-11" data-testid="select-vocab-language">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-primary">Vocabulary List:</h3>
                  <SaveButton
                    title={`Vocabulary: ${vocabTopic} (${vocabLanguage})`}
                    content={vocabResult}
                    onSave={() => save({ tool: "English Guru", title: `Vocabulary: ${vocabTopic} (${vocabLanguage})`, content: vocabResult })}
                  />
                </div>
                <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap">{vocabResult}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "translate" && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <CardTitle>Translate Text</CardTitle>
            <CardDescription>Translate between English and 12 Indian languages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mb-2">
              <Select value={translateLang} onValueChange={setTranslateLang}>
                <SelectTrigger className="w-full md:w-[250px] h-11" data-testid="select-translate-lang">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-primary">Translation:</h3>
                  <SaveButton
                    title={`Translation to ${translateLang}: "${translateText.slice(0, 40)}${translateText.length > 40 ? "…" : ""}"`}
                    content={translateResult}
                    onSave={() => save({ tool: "English Guru", title: `Translation to ${translateLang}: "${translateText.slice(0, 40)}${translateText.length > 40 ? "…" : ""}"`, content: translateResult })}
                  />
                </div>
                <div className="prose prose-sm md:prose-base max-w-none text-secondary whitespace-pre-wrap text-lg">{translateResult}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
