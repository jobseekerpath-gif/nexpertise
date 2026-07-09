import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Coins, Loader2, Check, QrCode, Copy, RefreshCw, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const UPI_ID = "abcfghijk@ybl";
const UPI_DISPLAY_NAME = "Edu Bharat";

type Stage = "pick" | "qr" | "pending" | "approved" | "rejected";

type Txn = { id: number; amount: number; balanceAfter: number; type: string; description: string | null; createdAt: string };

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

export default function B2BCredits() {
  const { company, isLoading, refetch } = useB2BAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("pick");
  const [amount, setAmount] = useState(200);
  const [utr, setUtr] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const QUICK_PICKS = [100, 200, 500, 1000];
  const valid = amount >= 50 && Number.isFinite(amount);

  const fetchTxns = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/b2b/credits/transactions`, { credentials: "include" });
      if (res.ok) setTxns(((await res.json()) as { transactions: Txn[] }).transactions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isLoading && !company) navigate("/b2b/login");
  }, [isLoading, company, navigate]);

  useEffect(() => {
    if (company) void fetchTxns();
  }, [company, fetchTxns]);

  // QR generation
  useEffect(() => {
    if (stage !== "qr" || !valid) return;
    setQrLoading(true);
    const uri = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_DISPLAY_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=EduBharat+B2B+Credits`;
    QRCode.toDataURL(uri, { width: 240, margin: 2 })
      .then((url) => { setQrDataUrl(url); setQrLoading(false); })
      .catch(() => setQrLoading(false));
  }, [stage, amount, valid]);

  // Poll for payment
  useEffect(() => {
    if (stage !== "pending" || paymentId === null) return;
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/api/b2b/credits/upi/status/${paymentId}`, { credentials: "include" });
        const data = (await res.json()) as { status?: string; credits?: number };
        if (data.status === "approved") {
          setStage("approved");
          void refetch();
          void fetchTxns();
        } else if (data.status === "rejected") {
          setStage("rejected");
        } else {
          pollRef.current = setTimeout(() => void poll(), 8000);
        }
      } catch {
        pollRef.current = setTimeout(() => void poll(), 8000);
      }
    };
    pollRef.current = setTimeout(() => void poll(), 5000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [stage, paymentId, refetch, fetchTxns]);

  const submitPayment = async () => {
    if (!utr.trim() || utr.trim().length < 6) {
      toast({ title: "Enter a valid UTR number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/credits/upi/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credits: amount, utr: utr.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; paymentId?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not submit payment");
      setPaymentId(data.paymentId!);
      setStage("pending");
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!company) return null;

  return (
    <div className="container mx-auto px-4 max-w-3xl py-8">
      <PageMeta title="Credits · B2B · EduBharat" description="Buy B2B interview credits" />
      <B2BNav />

      {/* Balance */}
      <Card className="mb-6 bg-gradient-to-br from-primary/5 to-orange-50 border-primary/20">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit Balance</p>
            <p className="text-3xl font-extrabold text-primary">{company.credits}</p>
            <p className="text-xs text-muted-foreground mt-0.5">2 credits per completed interview · 1 credit = ₹1</p>
          </div>
        </CardContent>
      </Card>

      {/* Top-up flow */}
      {stage === "pick" && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-secondary mb-4">Top up credits</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
              {QUICK_PICKS.map((n) => (
                <button key={n} onClick={() => setAmount(n)}
                  className={`px-4 py-2 rounded-lg border font-semibold text-sm transition-colors ${amount === n ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  ₹{n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                min={50} placeholder="Custom amount" className="max-w-[140px]" />
              <span className="text-sm text-muted-foreground">= {amount} credits</span>
            </div>
            <Button className="mt-4 font-bold" onClick={() => setStage("qr")} disabled={!valid}>
              <QrCode className="w-4 h-4 mr-1.5" />Pay ₹{amount} via UPI
            </Button>
          </CardContent>
        </Card>
      )}

      {stage === "qr" && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStage("pick")} className="text-muted-foreground hover:text-secondary">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-secondary">Pay ₹{amount} via UPI</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div>
                {qrLoading ? (
                  <div className="w-[200px] h-[200px] flex items-center justify-center bg-muted rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="UPI QR Code" className="w-[200px] h-[200px] rounded-xl border" />
                ) : null}
              </div>
              <div className="flex-1 space-y-3">
                <div className="bg-muted rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-mono text-secondary">{UPI_ID}</span>
                  <button onClick={() => { void navigator.clipboard.writeText(UPI_ID); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-xs text-primary font-semibold flex items-center gap-1">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">After paying, enter the UTR / transaction ID from your UPI app:</p>
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UTR number" />
                <Button onClick={() => void submitPayment()} disabled={submitting || utr.trim().length < 6} className="w-full font-bold">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Submitting…</> : "Submit UTR →"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "pending" && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-amber-800">Payment submitted</h2>
            <p className="text-sm text-amber-700 mt-1">Waiting for admin to verify your UPI payment (usually within a few hours). This page will update automatically.</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-600">
              <Clock className="w-3.5 h-3.5" /><span>Checking every 8 seconds…</span>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "approved" && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-green-800">{amount} credits added!</h2>
            <p className="text-sm text-green-700 mt-1">Your balance has been updated.</p>
            <Button className="mt-4 font-bold" onClick={() => { setStage("pick"); setUtr(""); }}>Top up more</Button>
          </CardContent>
        </Card>
      )}

      {stage === "rejected" && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-800">Payment not verified</h2>
            <p className="text-sm text-red-700 mt-1">We couldn't verify this payment. Please contact support with proof of payment.</p>
            <Button variant="outline" className="mt-4 font-bold" onClick={() => { setStage("pick"); setUtr(""); }}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Button variant="outline" size="sm" onClick={() => void fetchTxns()} className="mb-3">
        <RefreshCw className="w-4 h-4 mr-1.5" />Refresh transactions
      </Button>
      {txns.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <h3 className="text-sm font-bold text-secondary px-4 py-3 border-b border-border">Transaction history</h3>
            <div className="divide-y divide-border">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
