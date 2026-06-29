import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bookmark, LogIn, LogOut, User, BarChart2, Menu, X, BookOpen, Mic, Newspaper, Settings, FileText, Route } from "lucide-react";
import { useHistory } from "@/lib/use-history";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/english-guru",      label: "English Guru",      icon: BookOpen },
  { href: "/interview-ace",     label: "Interview Ace",     icon: Mic },
  { href: "/rozgar-samachar",   label: "Rozgar Samachar",   icon: Newspaper },
  { href: "/resume-intelligence", label: "Resume",          icon: FileText },
  { href: "/learning-journey",  label: "My Journey",        icon: Route },
];

export function Navbar() {
  const [location] = useLocation();
  const { items } = useHistory();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [location]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => location === href;

  return (
    <>
      <nav className="border-b bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="font-display font-extrabold text-2xl text-primary tracking-tight">
            EduBharat
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-semibold transition-colors hover:text-primary ${
                  isActive(href) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </Link>
            ))}

            <Link
              href="/progress"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary ${
                isActive("/progress") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              Progress
            </Link>

            <Link
              href="/history"
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary ${
                isActive("/history") ? "text-primary" : "text-muted-foreground"
              }`}
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
                <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name ?? user.email} width={32} height={32} className="w-8 h-8 rounded-full border-2 border-primary/20" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-secondary max-w-[120px] truncate">{user.name ?? user.email}</span>
                </Link>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={logout} title="Sign out">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="font-semibold">
                  <LogIn className="w-4 h-4 mr-1.5" />Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile: right side */}
          <div className="flex md:hidden items-center gap-3">
            {/* Saved badge */}
            {items.length > 0 && (
              <Link href="/history" className="relative p-2 min-h-11 min-w-11 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {items.length > 9 ? "9+" : items.length}
                </span>
              </Link>
            )}
            {/* User avatar shortcut */}
            {user && (
              user.picture
                ? <img src={user.picture} alt="" width={28} height={28} className="w-7 h-7 rounded-full border border-primary/20" />
                : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
            )}
            {/* Hamburger */}
            <button
              onClick={() => setOpen(o => !o)}
              className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="w-6 h-6 text-secondary" /> : <Menu className="w-6 h-6 text-secondary" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b">
          <span className="font-display font-extrabold text-xl text-primary">EduBharat</span>
          <button onClick={() => setOpen(false)} className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Drawer nav links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Tools</p>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                isActive(href)
                  ? "bg-primary/10 text-primary"
                  : "text-secondary hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {isActive(href) && <span className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />}
            </Link>
          ))}

          <div className="h-px bg-border my-3 mx-3" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">My Account</p>

          <Link
            href="/progress"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isActive("/progress") ? "bg-primary/10 text-primary" : "text-secondary hover:bg-muted"
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            Progress
          </Link>

          <Link
            href="/history"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isActive("/history") ? "bg-primary/10 text-primary" : "text-secondary hover:bg-muted"
            }`}
          >
            <Bookmark className="w-4 h-4 shrink-0" />
            Saved
            {items.length > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {items.length}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isActive("/profile") ? "bg-primary/10 text-primary" : "text-secondary hover:bg-muted"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            My Profile
          </Link>
        </div>

        {/* Drawer footer — auth */}
        <div className="border-t px-4 py-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img src={user.picture} alt="" width={36} height={36} className="w-9 h-9 rounded-full border-2 border-primary/20 shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary truncate">{user.name ?? "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" onClick={logout} title="Sign out">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <Link href="/login" className="block">
              <Button className="w-full font-bold">
                <LogIn className="w-4 h-4 mr-2" />Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
