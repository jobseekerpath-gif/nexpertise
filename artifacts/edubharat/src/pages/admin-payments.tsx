import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ShieldAlert, IndianRupee, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/lib/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Payment = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  credits: number;
  amountInr: number;
  utr: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

export default function AdminPayments() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [fetching, setFetching] = useState(false);
  const [acting, setActing] = useState<Record<number, boolean>>({});
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<number, boolean>>({});

  const isAdmin = user?.email === "admin@edubharat.in";

  const fetchPayments = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE}/api/credits/upi/pending`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Failed to load payments", variant: "destructive" }); return; }
      const data = await res.json() as { payments: Payment[] };
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

  const approve = useCallback(async (id: number) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`${BASE}/api/credits/upi/approve/${id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast({ title: "✅ Payment approved — credits granted" });
        void fetchPayments();
      } else {
        const d = await res.json() as { error?: string };
        toast({ title: "Approval failed", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
    }
  }, [fetchPayments, toast]);

  const reject = useCallback(async (id: number) => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      const res = await fetch(`${BASE}/api/credits/upi/reject/${id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason[id] ?? "" }),
      });
      if (res.ok) {
        toast({ title: "Payment rejected" });
        void fetchPayments();
      } else {
        const d = await res.json() as { error?: string };
        toast({ title: "Rejection failed", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setActing((a) => ({ ...a, [id]: false }));
      setShowRejectInput((s) => ({ ...s, [id]: false }));
    }
  }, [fetchPayments, rejectReason, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const pending = payments.filter((p) => p.status === "pending");
  const done = payments.filter((p) => p.status !== "pending");

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Payments · Admin · EduBharat" description="Manage UPI payment approvals" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">UPI Payments</h1>
          {pending.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchPayments()} disabled={fetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Pending payments */}
      {pending.length === 0 && !fetching ? (
        <Card className="mb-6">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-secondary">All caught up!</p>
            <p className="text-sm text-muted-foreground">No pending payments right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((p) => (
            <Card key={p.id} className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-secondary">{p.userName || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{p.userEmail}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1 font-bold text-secondary">
                        <IndianRupee className="w-3.5 h-3.5" />₹{p.amountInr} → {p.credits} credits
                      </span>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-secondary">
                        UTR: {p.utr}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />{formatDate(p.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold h-8"
                        onClick={() => void approve(p.id)}
                        disabled={acting[p.id]}
                      >
                        {acting[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 font-bold h-8"
                        onClick={() => setShowRejectInput((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        disabled={acting[p.id]}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                      </Button>
                    </div>
                    {showRejectInput[p.id] && (
                      <div className="flex gap-2 w-full sm:w-64">
                        <Input
                          placeholder="Reason (optional)"
                          className="h-8 text-xs"
                          value={rejectReason[p.id] ?? ""}
                          onChange={(e) => setRejectReason((r) => ({ ...r, [p.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 shrink-0 text-xs"
                          onClick={() => void reject(p.id)}
                          disabled={acting[p.id]}
                        >
                          Confirm
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent completed */}
      {done.length > 0 && (
        <>
          <h2 className="font-bold text-secondary mb-3">Recent completed</h2>
          <div className="space-y-2">
            {done.slice(0, 30).map((p) => (
              <Card key={p.id} className="border-border">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-secondary">{p.userName || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{p.userEmail}</span>
                      <span className="font-mono text-xs text-muted-foreground">UTR: {p.utr}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-secondary">₹{p.amountInr}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  {p.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {p.rejectionReason}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
