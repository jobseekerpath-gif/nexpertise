import { Navbar } from "./navbar";

export function Layout({
  children,
  compact = false,
  showFooter = true,
}: {
  children: React.ReactNode;
  compact?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className={compact ? "h-[100dvh] flex flex-col overflow-hidden" : "min-h-[100dvh] flex flex-col"}>
      <Navbar />
      <main className={compact ? "flex-1 flex flex-col overflow-hidden" : "flex-1 flex flex-col"}>
        {children}
      </main>
      {showFooter && (
        <footer className="bg-secondary text-secondary-foreground py-12 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p className="font-display font-bold text-xl mb-4 text-primary">EduBharat</p>
            <p className="text-secondary-foreground/60 text-sm max-w-md mx-auto">
              Empowering India's next generation with AI-driven learning tools for English fluency, interview preparation, and career growth.
            </p>
            <div className="mt-8 pt-8 border-t border-secondary-foreground/10 text-xs text-secondary-foreground/40">
              © {new Date().getFullYear()} EduBharat. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
