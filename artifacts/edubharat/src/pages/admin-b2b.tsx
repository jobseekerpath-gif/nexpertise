import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Building2, CheckCircle2, XCircle, RefreshCw, IndianRupee, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/lib/use-auth";
import { AdminNav } from "@/components/admin-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type B2BPayment = {
  id: number; companyId: number; credits: number; amountInr: number;
  utr: string; status: string; rejectionReason: string | null; reversedAt: string | null;
  createdAt: string; companyName: string | null; companyEmail: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  reversed: "bg-purple-100 text-purple-700",
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export default function AdminB2B() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [payments, setPayments] = useState<B2BPayment[]>([]);
  const [fetching, setFetching] = useState(false);
  const [acting, setActing] = useState<Record<number, boolean>>({});
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState<Record<number, boolean>>({});
  const [reverseReason, setReverseReason] = useState<Record<number, string>>({});
  const [showReverse, setShowReverse] = useState<Record<number, boolean>>({});

  const isAdmin = user?.isAdmin === true;

  const fetchPayments = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE}/api/admin/b2b/upi/pending`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Failed to load B2B payments", variant: "destructive" }); return; }
      const data = (await res.json()) as { payments: B2BPayment[] };
      setPayments(data.payments);
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
    if (isAdmin) void fetchPayments();
  }, [isAdmin, fetchPayments]);

  const approve = async (id: number) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`${BASE}/api/admin/b2b/upi/approve/${id}`, { method: "POST", credentials: "include" });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast({ title: "Credits granted ✓" });
      setPayments((p) => p.map((x) => x.id === id ? { ...x, status: "approved" } : x));
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  const reject = async (id: number) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`${BASE}/api/admin/b2b/upi/reject/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason[id] ?? "" }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast({ title: "Payment rejected" });
      setPayments((p) => p.map((x) => x.id === id ? { ...x, status: "rejected" } : x));
      setShowReject((s) => ({ ...s, [id]: false }));
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  const reverse = async (id: number) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`${BASE}/api/admin/b2b/upi/reverse/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reverseReason[id] ?? "" }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast({ title: "Payment reversed" });
      setPayments((p) => p.map((x) => x.id === id ? { ...x, status: "reversed" } : x));
      setShowReverse((s) => ({ ...s, [id]: false }));
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  if (isLoading) return <div className="flex justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground my-auto" /></div>;
  if (!isAdmin) return null;

  const pending = payments.filter((p) => p.status === "pending");

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="B2B Payments · Admin · EduBharat" description="Manage B2B company credit top-ups" />
      <AdminNav />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">B2B Payments</h1>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length} pending</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchPayments()} disabled={fetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {fetching && payments.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : payments.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No B2B payments yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-secondary">{p.companyName ?? `Company #${p.companyId}`}</span>
                      <span className="text-xs text-muted-foreground">{p.companyEmail}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? "bg-muted text-secondary"}`}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="font-bold text-secondary flex items-center gap-0.5">
                        <IndianRupee className="w-3.5 h-3.5" />{p.amountInr} → {p.credits} credits
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">UTR: {p.utr}</span>
                      <span className="text-xs text-muted-foreground">{fmt(p.createdAt)}</span>
                    </div>
                    {p.rejectionReason && <p className="text-xs text-red-600 mt-1">Reason: {p.rejectionReason}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {p.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 font-semibold"
                          onClick={() => void approve(p.id)} disabled={acting[p.id]}>
                          {acting[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}Approve
                        </Button>
                        {showReject[p.id] ? (
                          <div className="flex items-center gap-2">
                            <Input placeholder="Reason (optional)" value={rejectReason[p.id] ?? ""}
                              onChange={(e) => setRejectReason((r) => ({ ...r, [p.id]: e.target.value }))}
                              className="h-8 text-xs w-32" />
                            <Button size="sm" variant="destructive" onClick={() => void reject(p.id)} disabled={acting[p.id]}>
                              {acting[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reject"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowReject((s) => ({ ...s, [p.id]: false }))}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50"
                            onClick={() => setShowReject((s) => ({ ...s, [p.id]: true }))}>
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        )}
                      </>
                    )}
                    {p.status === "approved" && (
                      showReverse[p.id] ? (
                        <div className="flex items-center gap-2">
                          <Input placeholder="Reason" value={reverseReason[p.id] ?? ""}
                            onChange={(e) => setReverseReason((r) => ({ ...r, [p.id]: e.target.value }))}
                            className="h-8 text-xs w-32" />
                          <Button size="sm" variant="destructive" onClick={() => void reverse(p.id)} disabled={acting[p.id]}>
                            {acting[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reverse"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowReverse((s) => ({ ...s, [p.id]: false }))}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-purple-600 hover:bg-purple-50"
                          onClick={() => setShowReverse((s) => ({ ...s, [p.id]: true }))}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />Reverse
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
