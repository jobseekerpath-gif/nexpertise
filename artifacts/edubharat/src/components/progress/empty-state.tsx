import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function EmptyState({
  emoji, title, description, actionLabel, actionHref,
}: {
  emoji: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="text-center py-12 px-4 rounded-2xl border border-dashed bg-muted/30">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-lg font-display font-bold text-secondary mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">{description}</p>
      <Button onClick={() => navigate(actionHref)}>{actionLabel}</Button>
    </div>
  );
}
