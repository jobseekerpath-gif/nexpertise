import { Link, useLocation } from "wouter";
import { Bookmark, LogIn, LogOut, User } from "lucide-react";
import { useHistory } from "@/lib/use-history";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const { items } = useHistory();
  const { user, logout } = useAuth();

  const links = [
    { href: "/english-guru", label: "English Guru" },
    { href: "/interview-ace", label: "Interview Ace" },
    { href: "/rozgar-samachar", label: "Rozgar Samachar" },
  ];

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-extrabold text-2xl text-primary tracking-tight">
          EduBharat
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold transition-colors hover:text-primary ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/history"
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary ${
              location === "/history" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="link-history"
          >
            <Bookmark className="w-4 h-4" />
            Saved
            {items.length > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                {items.length > 99 ? "99+" : items.length}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {user.picture ? (
                <img src={user.picture} alt={user.name ?? user.email} className="w-8 h-8 rounded-full border-2 border-primary/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-sm font-medium text-secondary max-w-[120px] truncate">{user.name ?? user.email}</span>
              <Button variant="ghost" size="icon" className="w-8 h-8" onClick={logout} title="Sign out" data-testid="button-logout">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm" className="font-semibold" data-testid="button-login">
                <LogIn className="w-4 h-4 mr-1.5" />Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
