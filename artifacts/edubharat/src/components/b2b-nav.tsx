import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Users, Coins, LogOut } from "lucide-react";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { useToast } from "@/hooks/use-toast";

const TABS = [
  { href: "/b2b/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/b2b/campaigns", label: "Campaigns", icon: Briefcase },
  { href: "/b2b/candidates", label: "Candidates", icon: Users },
  { href: "/b2b/credits", label: "Credits", icon: Coins },
];

export function B2BNav() {
  const [location, navigate] = useLocation();
  const { company, logout } = useB2BAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
    navigate("/b2b/login");
  };

  return (
    <div className="flex items-center justify-between gap-2 mb-6 border-b border-border pb-0">
      <div className="flex items-center gap-1 overflow-x-auto">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-secondary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 shrink-0 pb-1">
        {company && (
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
            {company.name}
          </span>
        )}
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-secondary px-2 py-1 rounded"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
