import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TUTORS } from "@/lib/tutors";
import { Mic, MicOff, Volume2, VolumeX, Bookmark, BookmarkCheck } from "lucide-react";

export function MicButton({ isListening, isSupported, onStart, onStop, disabled }: {
  isListening: boolean; isSupported: boolean; onStart: () => void; onStop: () => void; disabled?: boolean;
}) {
  return (
    <Button type="button" variant={isListening ? "destructive" : "outline"} size="icon"
      onClick={isListening ? onStop : onStart} disabled={!isSupported || disabled}
      title={!isSupported ? "Voice not supported in this browser" : disabled ? "Mic unavailable during live chat" : isListening ? "Stop" : "Speak"} className="shrink-0 min-h-11 min-w-11">
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}

export function ResultPanel({ title, content, isSpeaking, onSpeak, onStop, onSave, saved }: {
  title: string; content: string; isSpeaking: boolean;
  onSpeak: () => void; onStop: () => void; onSave: () => void; saved: boolean;
}) {
  return (
    <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h3 className="font-bold text-primary text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={isSpeaking ? onStop : onSpeak} className="text-xs font-semibold h-8">
            {isSpeaking ? <><VolumeX className="w-3.5 h-3.5 mr-1" />Stop</> : <><Volume2 className="w-3.5 h-3.5 mr-1" />Speak</>}
          </Button>
          <Button variant="outline" size="sm" onClick={onSave} disabled={saved} className="text-xs font-semibold h-8">
            {saved ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" />Saved</> : <><Bookmark className="w-3.5 h-3.5 mr-1" />Save</>}
          </Button>
        </div>
      </div>
      <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  );
}

/** Tutor selector — accessible modal dialog for choosing a teacher */
export function TutorSelector({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Capture opener and restore focus on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // Initial focus — move to close button when dialog opens
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  // Focus trap inside the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    panel.addEventListener("keydown", trapFocus);
    return () => panel.removeEventListener("keydown", trapFocus);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        role="presentation"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-dialog-title"
        className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="tutor-dialog-title" className="text-xl font-display font-bold text-secondary">Choose Your AI Guru</h2>
            <p className="text-sm text-muted-foreground">Each teacher has a unique specialization and style</p>
          </div>
          <Button ref={closeBtnRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {TUTORS.map(tutor => {
            const isActive = tutor.id === currentId;
            return (
              <button
                key={tutor.id}
                onClick={() => { onSelect(tutor.id); onClose(); }}
                aria-pressed={isActive}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <img
                  src={tutor.imageSrc}
                  alt=""
                  aria-hidden="true"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover object-top border-2 shrink-0"
                  style={{ borderColor: isActive ? tutor.accentColor : "#e2e8f0" }}
                  loading="lazy"
                  decoding="async"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-secondary text-sm">{tutor.name}</p>
                    {isActive && <Badge className="text-[10px] h-4 px-1.5">Active</Badge>}
                  </div>
                  <p className="text-xs font-medium text-primary mt-0.5">{tutor.role}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tutor.specialization}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tutor.languages.slice(0, 2).map(l => (
                      <span key={l} className="text-[10px] rounded-full border bg-background px-2 py-0.5">{l}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
