import { useState } from "react";
import { useHistory } from "@/lib/use-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, BookmarkX, Clock, BookOpen, Mic, Newspaper } from "lucide-react";
import { PageMeta } from "@/components/page-meta";

const TOOL_META: Record<string, { icon: typeof BookOpen; color: string }> = {
  "English Guru": { icon: BookOpen, color: "bg-orange-100 text-orange-600" },
  "Interview Ace": { icon: Mic, color: "bg-green-100 text-green-600" },
  "Rozgar Samachar": { icon: Newspaper, color: "bg-purple-100 text-purple-600" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function History() {
  return (
    <>
      <PageMeta title="Saved Items" description="Your saved English Guru lessons, interview feedback, and Rozgar Samachar articles in one place." />
      <HistoryContent />
    </>
  );
}

function HistoryContent() {
  const { items, remove, clear } = useHistory();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-3xl text-center">
        <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookmarkX className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-3">No Saved Items</h1>
        <p className="text-muted-foreground text-lg">
          Hit the "Save" button on any AI response across English Guru, Interview Ace, or Rozgar Samachar and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary mb-1">Saved History</h1>
          <p className="text-muted-foreground text-sm">{items.length} saved response{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clear}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold"
          data-testid="button-clear-history"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const meta = TOOL_META[item.tool];
          const Icon = meta?.icon ?? BookOpen;
          const isOpen = expanded === item.id;

          return (
            <Card key={item.id} className="border shadow-sm overflow-hidden" data-testid={`history-item-${item.id}`}>
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta?.color ?? "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold leading-snug text-secondary truncate">
                        {item.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs font-medium px-2 py-0">
                          {item.tool}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.savedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="text-xs font-semibold h-8 px-3"
                      data-testid={`button-expand-${item.id}`}
                    >
                      {isOpen ? "Collapse" : "View"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(item.id)}
                      className="min-h-11 min-w-11 text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                    <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
