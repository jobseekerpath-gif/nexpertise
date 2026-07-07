import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Users as UsersIcon, ChevronDown, ChevronRight, Search, MapPin,
  Globe, Coins, RefreshCw, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/lib/use-auth";
import { AdminNav } from "@/components/admin-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type DirUser = {
  id: number;
  email: string;
  name: string | null;
  authProvider: string | null;
  credits: number;
  preferredLanguage: string | null;
  location: string | null;
  industryPreference: string | null;
  age: number | null;
  education: string | null;
  careerGoal: string | null;
  gender: string | null;
  degree: string | null;
  branch: string | null;
  graduationYear: string | null;
  university: string | null;
  preferredRole: string | null;
  preferredCity: string | null;
  expectedSalary: string | null;
  experienceLevel: string | null;
  englishLevel: string | null;
  signupIp: string | null;
  signupLocation: string | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type Purchase = {
  id: number; credits: number; amountInr: number; utr: string; status: string;
  rejectionReason: string | null; createdAt: string; reversedAt: string | null;
};
type Txn = {
  id: number; amount: number; balanceAfter: number; type: string;
  description: string | null; createdAt: string;
};
type Detail = { purchases: Purchase[]; transactions: Txn[] };

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  reversed: "bg-purple-100 text-purple-700",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-secondary break-words">{value}</p>
    </div>
  );
}

export default function AdminUsers() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [users, setUsers] = useState<DirUser[]>([]);
  const [fetching, setFetching] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Detail>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  const isAdmin = user?.isAdmin === true;

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE}/api/admin/users`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Failed to load users", variant: "destructive" }); return; }
      const data = (await res.json()) as { users: DirUser[] };
      setUsers(data.users);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/");
  }, [isLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) void fetchUsers();
  }, [isAdmin, fetchUsers]);

  const toggle = useCallback(async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!details[id]) {
      setLoadingDetail(id);
      try {
        const res = await fetch(`${BASE}/api/admin/users/${id}`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as Detail;
          setDetails((d) => ({ ...d, [id]: { purchases: data.purchases ?? [], transactions: data.transactions ?? [] } }));
        }
      } catch {
        toast({ title: "Could not load details", variant: "destructive" });
      } finally {
        setLoadingDetail(null);
      }
    }
  }, [expanded, details, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.location ?? "").toLowerCase().includes(q) ||
      (u.signupLocation ?? "").toLowerCase().includes(q) ||
      (u.lastLoginIp ?? "").includes(q) ||
      (u.signupIp ?? "").includes(q));
  }, [users, query]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Users · Admin · EduBharat" description="User directory" />
      <AdminNav />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">Users</h1>
          <span className="bg-muted text-secondary text-xs font-bold px-2 py-0.5 rounded-full">{users.length}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchUsers()} disabled={fetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, location or IP…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {fetching && users.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No users found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const open = expanded === u.id;
            const detail = details[u.id];
            return (
              <Card key={u.id} className="overflow-hidden">
                {/* Row header — click to expand */}
                <button
                  onClick={() => void toggle(u.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary truncate">{u.name || "Unnamed"}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" />{u.credits}</span>
                      {(u.lastLoginLocation || u.signupLocation) && (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{u.lastLoginLocation || u.signupLocation}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />joined {fmt(u.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail — scrollable */}
                {open && (
                  <div className="border-t border-border bg-muted/20 max-h-[70vh] overflow-y-auto px-4 py-4 space-y-5">
                    {/* Registration / profile */}
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Registration details</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="User ID" value={u.id} />
                        <Field label="Auth" value={u.authProvider} />
                        <Field label="Language" value={u.preferredLanguage} />
                        <Field label="Age" value={u.age} />
                        <Field label="Gender" value={u.gender} />
                        <Field label="Education" value={u.education} />
                        <Field label="Degree" value={u.degree} />
                        <Field label="Branch" value={u.branch} />
                        <Field label="Graduation" value={u.graduationYear} />
                        <Field label="University" value={u.university} />
                        <Field label="Career goal" value={u.careerGoal} />
                        <Field label="Industry" value={u.industryPreference} />
                        <Field label="Preferred role" value={u.preferredRole} />
                        <Field label="Preferred city" value={u.preferredCity} />
                        <Field label="Expected salary" value={u.expectedSalary} />
                        <Field label="Experience" value={u.experienceLevel} />
                        <Field label="English level" value={u.englishLevel} />
                        <Field label="Location" value={u.location} />
                      </div>
                    </section>

                    {/* Sign-in origin */}
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Sign-in origin
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Signup IP" value={u.signupIp} />
                        <Field label="Signup location" value={u.signupLocation} />
                        <Field label="Last login IP" value={u.lastLoginIp} />
                        <Field label="Last login location" value={u.lastLoginLocation} />
                        <Field label="Last login" value={fmt(u.lastLoginAt)} />
                      </div>
                    </section>

                    {/* Purchases + ledger */}
                    {loadingDetail === u.id && !detail ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading purchases…</div>
                    ) : detail ? (
                      <>
                        <section>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Purchases ({detail.purchases.length})</h3>
                          {detail.purchases.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No purchases.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {detail.purchases.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-card border border-border px-3 py-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap text-sm">
                                    <span className="font-semibold text-secondary">₹{p.amountInr} → {p.credits} cr</span>
                                    <span className="font-mono text-xs text-muted-foreground">UTR: {p.utr}</span>
                                    <span className="text-xs text-muted-foreground">{fmt(p.createdAt)}</span>
                                  </div>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? "bg-muted text-secondary"}`}>{p.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <section>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Credit ledger ({detail.transactions.length})</h3>
                          {detail.transactions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No transactions.</p>
                          ) : (
                            <div className="divide-y divide-border rounded-lg border border-border bg-card">
                              {detail.transactions.map((t) => (
                                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-sm text-secondary truncate">{t.description || t.type}</p>
                                    <p className="text-[11px] text-muted-foreground">{fmt(t.createdAt)}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`text-sm font-bold ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                                      {t.amount >= 0 ? "+" : ""}{t.amount}
                                    </span>
                                    <p className="text-[11px] text-muted-foreground">bal {t.balanceAfter}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
