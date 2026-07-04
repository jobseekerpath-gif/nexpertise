import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import QRCode from "qrcode";
import {
  Coins, Sparkles, Check, Loader2, Mic, MessageCircle, GraduationCap,
  LogIn, ShieldCheck, Infinity as InfinityIcon, QrCode, Clock, CheckCircle2,
  XCircle, ArrowLeft, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import {
  useCredits, submitUpiPayment, pollUpiPaymentStatus, fetchTransactions,
  CREDIT_MIN_PURCHASE, CREDIT_QUICK_PICKS, type CreditTx,
} from "@/lib/use-credits";

// ── Constants ─────────────────────────────────────────────────────────────────
const UPI_ID = "abcfghijk@ybl";
const UPI_DISPLAY_NAME = "Edu Bharat";

const TX_LABEL: Record<string, string> = {
  signup_grant: "Welcome bonus",
  purchase: "Top-up",
  spend_interview: "Interview",
  spend_live: "Live conversation",
  refund: "Refund",
  adjustment: "Adjustment",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function buildUpiUri(amount: number): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_DISPLAY_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `EduBharat Credits Top-up`,
  });
  return `upi://pay?${params.toString()}`;
}

// ── Stages ────────────────────────────────────────────────────────────────────
type Stage = "pick" | "qr" | "pending" | "approved" | "rejected";

export default function BuyCredits() {
  const { balance, authenticated, loaded } = useCredits();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [stage, setStage] = useState<Stage>("pick");
  const [amount, setAmount] = useState(99);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [txns, setTxns] = useState<CreditTx[]>([]);
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const valid = Number.isFinite(amount) && amount >= CREDIT_MIN_PURCHASE;

  // Fetch transactions for history
  useEffect(() => {
    if (authenticated) void fetchTransactions().then(setTxns);
  }, [authenticated, balance]);

  // Generate QR when entering qr stage
  useEffect(() => {
    if (stage !== "qr" || !valid) return;
    setQrLoading(true);
    QRCode.toDataURL(buildUpiUri(amount), { width: 240, margin: 2, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then((url) => { setQrDataUrl(url); setQrLoading(false); })
      .catch(() => { setQrLoading(false); });
  }, [stage, amount, valid]);

  // Poll for payment status when in pending stage
  useEffect(() => {
    if (stage !== "pending" || paymentId === null) return;

    const doPoll = async () => {
      const result = await pollUpiPaymentStatus(paymentId);
      if (!result) { scheduleNextPoll(); return; }
      if (result.status === "approved") {
        setStage("approved");
        toast({ title: `✅ ${result.credits ?? amount} credits added!`, description: "Your balance has been updated." });
      } else if (result.status === "rejected") {
        setStage("rejected");
      } else {
        scheduleNextPoll();
        setPollCount((c) => c + 1);
      }
    };

    const scheduleNextPoll = () => {
      pollTimerRef.current = setTimeout(() => void doPoll(), 6_000);
    };

    void doPoll();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paymentId]);

  const handleCopyUpiId = useCallback(() => {
    void navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleSubmitUtr = useCallback(async () => {
    const trimmed = utr.trim();
    if (trimmed.length < 6) {
      toast({ title: "Enter a valid UTR number", description: "Your UTR is shown in the payment receipt in your UPI app.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const result = await submitUpiPayment(amount, trimmed);
    setSubmitting(false);
    if (result.ok && result.paymentId) {
      setPaymentId(result.paymentId);
      setStage("pending");
    } else {
      toast({ title: "Submission failed", description: result.error ?? "Please try again.", variant: "destructive" });
    }
  }, [utr, amount, toast]);

  const uses = useMemo(() => [
    { icon: MessageCircle, title: "Live Conversation", cost: "5 credits / hour", note: "Real-time voice practice with your tutor" },
    { icon: Mic, title: "Mock Interviews", cost: "5 credits each", note: "Flat rate — any length session" },
    { icon: GraduationCap, title: "Everything else", cost: "Free", note: "Lessons, grammar, writing, vocab, jobs & news" },
  ], []);

  // ── Step 1: Pick amount ──────────────────────────────────────────────────────
  const renderPick = () => (
    <Card className="mb-6 border shadow-sm">
      <CardContent className="py-6">
        <h2 className="font-bold text-secondary mb-4">Choose an amount</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
          {CREDIT_QUICK_PICKS.map((c) => (
            <button
              key={c}
              onClick={() => setAmount(c)}
              className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all hover:shadow-sm ${
                amount === c ? "border-amber-400 bg-amber-50" : "border-border bg-card hover:border-amber-200"
              }`}
            >
              {c === 99 && (
                <span className="absolute -top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
              <span className="block text-lg font-extrabold text-secondary flex items-center gap-1">
                <Coins className="w-4 h-4 text-amber-500" />{c}
              </span>
              <span className="block text-xs text-muted-foreground">₹{c}</span>
            </button>
          ))}
          <div className={`rounded-xl border-2 px-3 py-2 flex flex-col justify-center transition-all ${
            !CREDIT_QUICK_PICKS.includes(amount) ? "border-amber-400 bg-amber-50" : "border-border"
          }`}>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1">Custom</label>
            <input
              type="number"
              min={CREDIT_MIN_PURCHASE}
              value={amount}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value)))}
              className="w-full bg-transparent text-lg font-extrabold text-secondary outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 mb-5">
          <span className="text-sm text-muted-foreground">You'll get</span>
          <span className="font-bold text-secondary">
            {valid ? amount : "—"} credits{" "}
            <span className="text-muted-foreground font-normal">for ₹{valid ? amount : "—"}</span>
          </span>
        </div>

        <Button
          className="w-full h-12 font-bold text-base bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => { if (valid) setStage("qr"); }}
          disabled={!valid}
        >
          <QrCode className="w-5 h-5 mr-2" />
          Pay ₹{valid ? amount : "—"} via UPI
        </Button>
        {!valid && <p className="text-xs text-center text-destructive mt-2">Minimum top-up is {CREDIT_MIN_PURCHASE} credits.</p>}
      </CardContent>
    </Card>
  );

  // ── Step 2: Show QR + UTR form ───────────────────────────────────────────────
  const renderQr = () => (
    <Card className="mb-6 border shadow-sm">
      <CardContent className="py-6">
        <button onClick={() => setStage("pick")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5 hover:text-secondary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-5">
          <p className="font-bold text-secondary text-lg mb-1">Scan to pay ₹{amount}</p>
          <p className="text-sm text-muted-foreground">Open any UPI app — GPay, PhonePe, Paytm, BHIM</p>
        </div>

        {/* QR code */}
        <div className="flex justify-center mb-4">
          <div className="rounded-2xl border-4 border-amber-400 p-2 bg-white shadow-lg">
            {qrLoading ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI QR code" className="w-[200px] h-[200px] rounded-lg" />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                QR unavailable
              </div>
            )}
          </div>
        </div>

        {/* UPI ID + copy */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-sm font-mono font-semibold text-secondary">{UPI_ID}</span>
          <button
            onClick={handleCopyUpiId}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Copy UPI ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mb-6">{UPI_DISPLAY_NAME}</p>

        {/* Steps */}
        <ol className="text-sm text-muted-foreground space-y-1.5 mb-6 pl-4 list-decimal">
          <li>Scan the QR with any UPI app and pay <strong className="text-secondary">₹{amount}</strong></li>
          <li>Note the <strong className="text-secondary">UTR / Reference number</strong> from your payment receipt</li>
          <li>Enter it below and submit — we'll add your credits once we verify</li>
        </ol>

        {/* UTR input */}
        <div className="space-y-3">
          <Input
            placeholder="Enter UTR / Reference number (e.g. 429012345678)"
            value={utr}
            onChange={(e) => setUtr(e.target.value.toUpperCase())}
            className="font-mono text-sm"
            maxLength={30}
          />
          <Button
            className="w-full h-11 font-bold bg-green-600 hover:bg-green-700 text-white"
            onClick={() => void handleSubmitUtr()}
            disabled={submitting || utr.trim().length < 6}
          >
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "I've paid — submit UTR"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 3: Pending ──────────────────────────────────────────────────────────
  const renderPending = () => (
    <Card className="mb-6 border-amber-200 bg-amber-50/60 shadow-sm">
      <CardContent className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
        </div>
        <h2 className="font-bold text-secondary text-xl mb-2">Waiting for approval</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Your payment of <strong className="text-secondary">₹{amount}</strong> is under review.
        </p>
        <p className="text-xs text-muted-foreground">
          We check within a few minutes. This page updates automatically
          {pollCount > 0 ? ` (checked ${pollCount} time${pollCount > 1 ? "s" : ""})` : ""}.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking every 6 seconds…
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 4: Approved ─────────────────────────────────────────────────────────
  const renderApproved = () => (
    <Card className="mb-6 border-green-200 bg-green-50/60 shadow-sm">
      <CardContent className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-bold text-secondary text-xl mb-2">Payment approved! 🎉</h2>
        <p className="text-sm text-muted-foreground mb-6">
          <strong className="text-secondary">{amount} credits</strong> have been added to your account.
          Your new balance is <strong className="text-secondary">{balance ?? "…"} credits</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="bg-primary hover:bg-primary/90 font-bold" onClick={() => navigate("/")}>
            Go to dashboard
          </Button>
          <Button variant="outline" onClick={() => { setStage("pick"); setUtr(""); setPaymentId(null); }}>
            Buy more credits
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 5: Rejected ─────────────────────────────────────────────────────────
  const renderRejected = () => (
    <Card className="mb-6 border-destructive/30 bg-destructive/5 shadow-sm">
      <CardContent className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="font-bold text-secondary text-xl mb-2">Payment not approved</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The UTR you submitted could not be verified. Please double-check the UTR number from your UPI app and try again, or contact us.
        </p>
        <Button variant="outline" onClick={() => { setStage("qr"); setUtr(""); setPaymentId(null); }}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 max-w-3xl py-8">
      <PageMeta title="Buy Credits · EduBharat" description="Top up EduBharat credits via UPI. 1 credit = ₹1. Credits never expire." />

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Coins className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-secondary mb-2">EduBharat Credits</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          1 credit = <span className="font-semibold text-secondary">₹1</span>. Pay via UPI — GPay, PhonePe, Paytm, or any UPI app.
          Credits never expire.
        </p>
      </div>

      {/* Balance / sign-in */}
      {loaded && authenticated ? (
        <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="py-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-1">Your balance</p>
              <p className="text-4xl font-display font-extrabold text-secondary flex items-center gap-2">
                <Coins className="w-7 h-7 text-amber-500" />
                {balance ?? "…"}
                <span className="text-lg font-semibold text-muted-foreground">credits</span>
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><InfinityIcon className="w-3.5 h-3.5" /> Never expire</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> UPI secured</span>
            </div>
          </CardContent>
        </Card>
      ) : loaded && !authenticated ? (
        <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-primary/5 to-white">
          <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-secondary">Get 20 free credits</p>
                <p className="text-sm text-muted-foreground">Sign in to claim your welcome bonus and start practising right away.</p>
              </div>
            </div>
            <Link href="/login">
              <Button className="font-bold shrink-0"><LogIn className="w-4 h-4 mr-1.5" />Sign in</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {/* Purchase flow — authenticated only */}
      {loaded && authenticated && (
        <>
          {stage === "pick" && renderPick()}
          {stage === "qr" && renderQr()}
          {stage === "pending" && renderPending()}
          {stage === "approved" && renderApproved()}
          {stage === "rejected" && renderRejected()}
        </>
      )}

      {/* How credits work */}
      {(stage === "pick" || stage === "approved") && (
        <Card className="mb-6 border shadow-sm">
          <CardContent className="py-6">
            <h2 className="font-bold text-secondary mb-4">How credits work</h2>
            <div className="space-y-3">
              {uses.map(({ icon: Icon, title, cost, note }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-secondary text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${cost === "Free" ? "text-green-600" : "text-secondary"}`}>{cost}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><InfinityIcon className="w-3.5 h-3.5" /> Credits never expire</span>
              <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> No subscription</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Instant UPI payment</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      {authenticated && txns.length > 0 && (stage === "pick" || stage === "approved") && (
        <Card className="border shadow-sm">
          <CardContent className="py-6">
            <h2 className="font-bold text-secondary mb-4">Recent activity</h2>
            <div className="divide-y">
              {txns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary truncate">{tx.description || TX_LABEL[tx.type] || tx.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-sm font-bold ${tx.amount >= 0 ? "text-green-600" : "text-secondary"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </span>
                    <p className="text-[11px] text-muted-foreground">bal {tx.balanceAfter}</p>
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
