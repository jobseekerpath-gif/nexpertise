import { Link, useLocation } from "wouter";
import { CreditCard, Users, FileText } from "lucide-react";

const TABS = [
  { href: "/admin-payments", label: "Payments", icon: CreditCard },
  { href: "/admin-users", label: "Users", icon: Users },
  { href: "/admin-content", label: "Content", icon: FileText },
];

/** Shared tab bar shown across the admin pages. */
export function AdminNav() {
  const [location] = useLocation();
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = location === href || (href === "/admin-payments" && location === "/admin");
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
  );
}
