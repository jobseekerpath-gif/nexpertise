import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Coins, Sparkles, Check, Loader2, Mic, MessageCircle, GraduationCap,
  LogIn, ArrowRight, ShieldCheck, Infinity as InfinityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import {
  useCredits, startCheckout, confirmCheckout, fetchTransactions,
  CREDIT_MIN_PURCHASE, CREDIT_QUICK_PICKS, type CreditTx,
} from "@/lib/use-credits";

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
  } catch {
    return "";
  }
}

export default function BuyCredits() {
  const { balance, authenticated, loaded, refetch } = useCredits();
  const { toast } = useToast();
  const [amount, setAmount] = useState(99);
  const [buying, setBuying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [txns, setTxns] = useState<CreditTx[]>([]);

  const valid = Number.isFinite(amount) && amount >= CREDIT_MIN_PURCHASE;

  const runConfirm = useCallback(
    async (sessionId: string) => {
      setConfirming(true);
      const r = await confirmCheckout(sessionId);
      setConfirming(false);
      if (r.ok) {
        if (r.already) toast({ title: "Credits already added", description: `Balance: ${r.balance} credits` });
        else toast({ title: `Added ${r.credited} credits 🎉`, description: `New balance: ${r.balance} credits` });
        setPendingSession(null);
        // Only clear the return params once crediting is confirmed.
        window.history.replaceState({}, "", window.location.pathname);
        void refetch();
      } else {
        // Keep the paid session id so the user can retry — no credits are lost.
        setPendingSession(sessionId);
        toast({
          title: "Payment not confirmed yet",
          description: "If you were charged, tap Retry — your credits are safe.",
          variant: "destructive",
        });
      }
    },
    [refetch, toast],
  );

  // Handle the redirect back from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const sessionId = params.get("session_id");
    if (status === "success" && sessionId) {
      void runConfirm(sessionId);
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled" });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authenticated) void fetchTransactions().then(setTxns);
  }, [authenticated, balance]);

  const buy = async () => {
    if (!valid) {
      toast({ title: "Minimum top-up is 49 credits", variant: "destructive" });
      return;
    }
    setBuying(true);
    const r = await startCheckout(Math.floor(amount));
    if (!r.ok) {
      setBuying(false);
      toast({ title: "Couldn't start checkout", description: r.error, variant: "destructive" });
    }
    // On success the browser redirects to Stripe.
  };

  const uses = useMemo(
    () => [
      { icon: MessageCircle, title: "Live Conversation", cost: "5 credits / hour", note: "Real-time voice practice with your tutor" },
      { icon: Mic, title: "Mock Interviews", cost: "2–5 credits each", note: "By length — 10 min = 2, 25 min = 5" },
      { icon: GraduationCap, title: "Everything else", cost: "Free", note: "Lessons, grammar, writing, vocab, jobs & news" },
    ],
    [],
  );

  return (
    <div className="container mx-auto px-4 max-w-3xl py-8">
      <PageMeta title="Buy Credits · EduBharat" description="Top up EduBharat credits. 1 credit = ₹1. Credits never expire." />

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Coins className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-secondary mb-2">EduBharat Credits</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          1 credit = <span className="font-semibold text-secondary">₹1</span>. Use them for live conversation and mock
          interviews — everything else stays free. Credits never expire.
        </p>
      </div>

      {confirming && (
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Confirming your payment…
        </div>
      )}

      {pendingSession && !confirming && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-secondary">We couldn't confirm your payment yet</p>
              <p className="text-sm text-muted-foreground">If you completed checkout, your credits are safe — tap Retry.</p>
            </div>
            <Button variant="outline" className="font-bold shrink-0" onClick={() => runConfirm(pendingSession)}>
              Retry confirmation
            </Button>
          </CardContent>
        </Card>
      )}

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
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Secure checkout</span>
            </div>
          </CardContent>
        </Card>
      ) : loaded && !authenticated ? (
        <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-primary/5 to-white">
          <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-secondary">Get 99 free credits</p>
                <p className="text-sm text-muted-foreground">Sign in to claim your welcome bonus — enough for about a month of use.</p>
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

      {/* Purchase card (authenticated only) */}
      {loaded && authenticated && (
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
                    <Coins className="w-4 h-4 text-amber-500" />
                    {c}
                  </span>
                  <span className="block text-xs text-muted-foreground">₹{c}</span>
                </button>
              ))}
              {/* Custom amount */}
              <div
                className={`rounded-xl border-2 px-3 py-2 flex flex-col justify-center transition-all ${
                  !CREDIT_QUICK_PICKS.includes(amount) ? "border-amber-400 bg-amber-50" : "border-border"
                }`}
              >
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

            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 mb-4">
              <span className="text-sm text-muted-foreground">You'll get</span>
              <span className="font-bold text-secondary">
                {valid ? amount : "—"} credits{" "}
                <span className="text-muted-foreground font-normal">for ₹{valid ? amount : "—"}</span>
              </span>
            </div>

            <Button className="w-full h-12 font-bold text-base bg-amber-500 hover:bg-amber-600 text-white" onClick={buy} disabled={buying || !valid}>
              {buying ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Redirecting to checkout…</>
              ) : (
                <>Buy {valid ? amount : ""} credits<ArrowRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
            {!valid && <p className="text-xs text-center text-destructive mt-2">Minimum top-up is {CREDIT_MIN_PURCHASE} credits.</p>}
          </CardContent>
        </Card>
      )}

      {/* How credits work */}
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
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Secure Stripe checkout</span>
          </div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      {authenticated && txns.length > 0 && (
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
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount}
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
