import { Badge } from "@/components/ui/badge";
import { ROADMAP_STAGES } from "@/lib/english-roadmap";

/**
 * CEFR A1→C2 English roadmap timeline. `currentStage` is the CEFR code
 * (e.g. "A1", "B1", "C1") that the learner is currently at.
 */
export function RoadmapTimeline({ currentStage }: { currentStage: string }) {
  return (
    <div className="relative space-y-4">
      {ROADMAP_STAGES.map((stage, idx) => {
        const isCurrent = stage.level === currentStage;
        const isPast = ROADMAP_STAGES.findIndex(s => s.level === currentStage) > idx;
        return (
          <div key={stage.level} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold border-2 shrink-0 ${isCurrent ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30" : isPast ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}>
                {isPast ? "✓" : stage.level}
              </div>
              {idx < ROADMAP_STAGES.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-[16px] ${isPast ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
            <div className={`flex-1 p-4 rounded-xl border-2 mb-1 transition-all ${isCurrent ? "border-primary bg-orange-50/80 shadow-sm" : isPast ? "border-primary/20 bg-green-50/40" : `${stage.color}`}`}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-secondary text-sm">{stage.level} — {stage.label}</span>
                  {isCurrent && <Badge className="text-[10px] px-1.5 py-0 h-5">You are here</Badge>}
                  {isPast && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary">Completed</Badge>}
                  <span className="text-[10px] font-semibold text-muted-foreground">{stage.weeks}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {stage.topics.map(t => (
                  <span key={t} className={`text-xs px-2 py-0.5 rounded-full border ${isCurrent ? "bg-primary/10 border-primary/20 text-primary font-medium" : isPast ? "bg-primary/5 border-primary/10 text-primary/60" : "bg-white/70 border-border/60 text-muted-foreground"}`}>{t}</span>
                ))}
              </div>
              <div className={`grid gap-2 text-xs mt-2 pt-2 border-t ${isPast ? "border-primary/10" : isCurrent ? "border-primary/20" : "border-border/40"}`}>
                <div className="flex gap-1.5 items-start">
                  <span className="shrink-0 font-bold">🎯 Daily goal:</span>
                  <span className="text-muted-foreground">{stage.dailyGoal}</span>
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="shrink-0 font-bold">🏁 Milestone:</span>
                  <span className="text-muted-foreground">{stage.milestone}</span>
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="shrink-0 font-bold">📚 Resources:</span>
                  <span className="text-muted-foreground">{stage.resources}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
