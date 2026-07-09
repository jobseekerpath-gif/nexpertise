import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark, LogIn, LogOut, User, BarChart2, Menu, X,
  BookOpen, Mic, Newspaper, Settings, FileText, Route,
  Coins, Sparkles, Shield, CreditCard, Users as UsersIcon,
  Briefcase, ChevronDown, Building2,
} from "lucide-react";
import { useHistory } from "@/lib/use-history";
import { useAuth } from "@/lib/use-auth";
import { useCredits } from "@/lib/use-credits";
import { Button } from "@/components/ui/button";

const FLUENCY_LINKS = [
  { href: "/english-guru",     label: "English Guru", icon: BookOpen, desc: "Live AI conversation" },
  { href: "/tools-pro",        label: "Tools Pro",    icon: Sparkles, desc: "Grammar, writing & vocab" },
  { href: "/learning-journey", label: "My Journey",   icon: Route,    desc: "CEFR roadmap A1→C2" },
];

const CAREER_LINKS = [
  { href: "/interview-ace",       label: "Interview Ace",   icon: Mic,      desc: "Mock interviews & feedback" },
  { href: "/rozgar-samachar",     label: "Rozgar Samachar", icon: Newspaper, desc: "Live jobs & career news" },
  { href: "/resume-intelligence", label: "Resume",          icon: FileText,  desc: "ATS score & keywords" },
];

/** Hover-triggered dropdown for a suite group */
function SuiteDropdown({
  label,
  links,
  color,
  icon: BadgeIcon,
  isAnyActive,
}: {
  label: string;
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[];
  color: "orange" | "blue";
  icon: React.ComponentType<{ className?: string }>;
  isAnyActive: boolean;
}) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = color === "orange"
    ? { badge: "from-orange-500 to-amber-400 shadow-orange-200/60", dot: "bg-orange-400", link: "text-orange-600 bg-orange-50 ring-1 ring-orange-200", hover: "hover:text-orange-600 hover:bg-orange-50", divider: "border-orange-100", iconBg: "bg-orange-100 text-orange-600" }
    : { badge: "from-blue-600 to-indigo-500 shadow-blue-200/60", dot: "bg-blue-500", link: "text-blue-700 bg-blue-50 ring-1 ring-blue-200", hover: "hover:text-blue-700 hover:bg-blue-50", divider: "border-blue-100", iconBg: "bg-blue-100 text-blue-600" };

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => { setOpen(false); }, [location]);

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${
          isAnyActive
            ? `bg-gradient-to-r ${accent.badge} text-white shadow-md`
            : `text-muted-foreground hover:text-secondary hover:bg-muted/60`
        }`}
      >
        <BadgeIcon className="w-3 h-3 shrink-0" />
        {label}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-border/60 py-2 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          <p className={`text-[10px] font-bold uppercase tracking-widest px-3 pb-1.5 pt-0.5 ${color === "orange" ? "text-orange-500" : "text-blue-600"}`}>
            {label}
          </p>
          {links.map(({ href, label: lbl, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-colors ${
                location === href ? accent.link : `text-secondary ${accent.hover}`
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accent.iconBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{lbl}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [location] = useLocation();
  const { items } = useHistory();
  const { user, logout } = useAuth();
  const { balance, authenticated, refetch: refetchCredits } = useCredits();
  const [open, setOpen] = useState(false);

  useEffect(() => { void refetchCredits(); }, [user?.id, refetchCredits]);
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => location === href;
  const fluencyActive = FLUENCY_LINKS.some(l => l.href === location);
  const careerActive  = CAREER_LINKS.some(l => l.href === location);

  return (
    <>
      <nav className="border-b bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center gap-1">

          {/* Logo */}
          <Link href="/" className="font-display font-extrabold text-xl text-primary tracking-tight shrink-0 mr-1">
            EduBharat
          </Link>

          {/* ── Suite dropdowns ── */}
          <SuiteDropdown
            label="Fluency Suite"
            links={FLUENCY_LINKS}
            color="orange"
            icon={Sparkles}
            isAnyActive={fluencyActive}
          />
          <SuiteDropdown
            label="Career Suite"
            links={CAREER_LINKS}
            color="blue"
            icon={Briefcase}
            isAnyActive={careerActive}
          />

          {/* ── Utility links ── (desktop only) */}
          <div className="hidden md:flex items-center gap-0.5 ml-0.5">
            <span className="w-px h-4 bg-border mx-1 shrink-0" />

            <Link
              href="/progress"
              title="Progress"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive("/progress") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-primary hover:bg-muted/60"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Progress</span>
            </Link>

            <Link
              href="/history"
              title="Saved"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive("/history") ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-primary hover:bg-muted/60"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved</span>
              {items.length > 0 && (
                <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {items.length > 9 ? "9+" : items.length}
                </span>
              )}
            </Link>

            {/* Recruiters link */}
            <Link
              href="/b2b/login"
              title="Recruiter Portal"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                location.startsWith("/b2b") ? "text-violet-700 bg-violet-50" : "text-muted-foreground hover:text-violet-700 hover:bg-violet-50"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Recruiters</span>
            </Link>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── Right actions (desktop) ── */}
          <div className="hidden md:flex items-center gap-1.5">
            {user?.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 px-2.5 py-1 text-xs font-bold hover:bg-violet-100 transition-colors"
                title="Admin Panel"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}

            {authenticated && (
              <Link
                href="/credits"
                className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 text-xs font-bold hover:bg-amber-100 transition-colors"
                title="Your credits"
              >
                <Coins className="w-3.5 h-3.5" />
                {balance ?? "…"}
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-1.5">
                <Link href="/profile" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name ?? user.email} width={28} height={28} className="w-7 h-7 rounded-full border-2 border-primary/20" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-secondary max-w-[96px] truncate">{user.name ?? user.email}</span>
                </Link>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} title="Sign out">
                  <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs font-semibold">
                  <LogIn className="w-3.5 h-3.5 mr-1" />Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* ── Mobile right side ── */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            {authenticated && (
              <Link href="/credits" className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-xs font-bold" title="Your credits">
                <Coins className="w-3 h-3" />
                {balance ?? "…"}
              </Link>
            )}
            {items.length > 0 && (
              <Link href="/history" className="relative p-2 min-h-11 min-w-11 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {items.length > 9 ? "9+" : items.length}
                </span>
              </Link>
            )}
            {user && (
              user.picture
                ? <img src={user.picture} alt="" width={26} height={26} className="w-6.5 h-6.5 rounded-full border border-primary/20" />
                : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
            )}
            <button
              onClick={() => setOpen(o => !o)}
              className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="w-5 h-5 text-secondary" /> : <Menu className="w-5 h-5 text-secondary" />}
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
        <div className="flex items-center justify-between px-5 h-14 border-b">
          <span className="font-display font-extrabold text-lg text-primary">EduBharat</span>
          <button onClick={() => setOpen(false)} className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {/* Fluency Suite */}
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Fluency Suite</p>
          </div>
          {FLUENCY_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                isActive(href) ? "bg-orange-50 text-primary" : "text-secondary hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {isActive(href) && <span className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />}
            </Link>
          ))}

          <div className="h-px bg-border my-3 mx-3" />

          {/* Career Suite */}
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Career Suite</p>
          </div>
          {CAREER_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                isActive(href) ? "bg-blue-50 text-blue-700" : "text-secondary hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {isActive(href) && <span className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />}
            </Link>
          ))}

          <div className="h-px bg-border my-3 mx-3" />

          {/* Recruiter Portal */}
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">For Recruiters</p>
          </div>
          <Link
            href="/b2b/login"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
              location.startsWith("/b2b") ? "bg-violet-50 text-violet-700" : "text-secondary hover:bg-muted"
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Recruiter Portal
          </Link>

          {user?.isAdmin && (
            <>
              <div className="h-px bg-border my-3 mx-3" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Admin Panel</p>
              <Link
                href="/admin-payments"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive("/admin-payments") || isActive("/admin") ? "bg-violet-50 text-violet-700" : "text-secondary hover:bg-muted"
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                Payments
              </Link>
              <Link
                href="/admin-users"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive("/admin-users") ? "bg-violet-50 text-violet-700" : "text-secondary hover:bg-muted"
                }`}
              >
                <UsersIcon className="w-4 h-4 shrink-0" />
                Users
              </Link>
              <Link
                href="/admin-content"
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive("/admin-content") ? "bg-violet-50 text-violet-700" : "text-secondary hover:bg-muted"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                Content
              </Link>
            </>
          )}

          <div className="h-px bg-border my-3 mx-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">My Account</p>

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

          <Link
            href="/credits"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isActive("/credits") ? "bg-primary/10 text-primary" : "text-secondary hover:bg-muted"
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            Credits
            {authenticated && (
              <span className="ml-auto inline-flex items-center gap-1 text-amber-600 font-bold text-xs">
                <Coins className="w-3.5 h-3.5" />{balance ?? "…"}
              </span>
            )}
          </Link>
        </div>

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
