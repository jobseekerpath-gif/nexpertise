import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/use-auth";
import { Loader2, Mail, ArrowRight, ShieldCheck, AlertTriangle, Copy, CheckCheck } from "lucide-react";
import { PageMeta } from "@/components/page-meta";

type AuthConfig = {
  googleConfigured: boolean;
  googleCallbackUrl: string;
  otpEmailConfigured: boolean;
  otpDevMode: boolean;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Login() {
  return (
    <>
      <PageMeta title="Sign In" description="Sign in to EduBharat to sync your progress across devices and save jobs, sessions, and insights." noindex />
      <LoginContent />
    </>
  );
}

function LoginContent() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { loginWithGoogle, sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    // Show error from Google OAuth redirect (e.g. ?error=google_failed)
    const params = new URLSearchParams(search);
    const e = params.get("error");
    if (e === "google_failed") return "Google Sign-In failed. Please try again or use Email OTP below.";
    return "";
  });
  const [devCode, setDevCode] = useState<string | undefined>();
  // Fail open: assume Google is configured until we hear otherwise.
  // This prevents the button from being disabled on transient config-fetch errors.
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/auth/config`, { credentials: "include" })
      .then(r => r.json())
      .then((d: AuthConfig) => { setConfig(d); setConfigLoaded(true); })
      .catch(() => {
        // Config fetch failed — fail open so Google button still works
        setConfigLoaded(true);
      });
  }, []);

  const handleSendOtp = async () => {
    if (!email.trim()) { setError("Please enter your email"); return; }
    setLoading(true);
    setError("");
    const result = await sendOtp(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setStep("otp");
      setDevCode(result.dev);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { setError("Please enter the OTP"); return; }
    setLoading(true);
    setError("");
    // Pass any guest ID so the server can merge lesson progress into the account
    const guestId = localStorage.getItem("edubharat_guest_id") ?? undefined;
    const result = await verifyOtp(email, otp, guestId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate("/");
    }
  };

  const copyCallbackUrl = () => {
    if (!config?.googleCallbackUrl) return;
    void navigator.clipboard.writeText(config.googleCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fail open: treat Google as ready until config explicitly says it isn't.
  // This prevents a transient /api/auth/config failure from disabling the button.
  const googleReady = configLoaded ? (config?.googleConfigured ?? true) : true;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-display font-extrabold text-primary mb-2">EduBharat</h1>
          <p className="text-muted-foreground">India's AI Career Ecosystem</p>
        </div>

        {/* Google OAuth setup notice — shown when callback URL isn't registered */}
        {config && !googleReady && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Google Sign-In needs one-time setup
            </div>
            <p className="text-amber-700 text-xs leading-relaxed">
              Add this URL to your{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Google Cloud Console
              </a>{" "}
              → OAuth 2.0 Client → Authorized redirect URIs:
            </p>
            <div className="flex items-center gap-2 bg-white rounded border border-amber-200 px-3 py-2">
              <code className="text-xs text-amber-900 flex-1 break-all">{config.googleCallbackUrl}</code>
              <button onClick={copyCallbackUrl} className="shrink-0 text-amber-600 hover:text-amber-800">
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-amber-600 text-xs">
              Or set <code className="bg-amber-100 px-1 rounded">GOOGLE_CALLBACK_URL</code> in Replit Secrets to that URL for a stable redirect. Use Email OTP below in the meantime.
            </p>
          </div>
        )}

        {/* Google OAuth setup notice — configured but let user know it might still mismatch if URL changed */}
        {config && googleReady && (
          <details className="rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 p-3 cursor-pointer">
            <summary className="font-medium text-slate-600 select-none">Google Sign-In configured ✓</summary>
            <p className="mt-2 leading-relaxed">
              If you see a redirect_uri_mismatch error, add this exact URL to Google Cloud Console → Authorized redirect URIs:
            </p>
            <div className="flex items-center gap-2 bg-white rounded border border-slate-200 px-2 py-1.5 mt-1.5">
              <code className="flex-1 break-all">{config.googleCallbackUrl}</code>
              <button onClick={copyCallbackUrl} className="shrink-0 text-slate-500 hover:text-slate-700">
                {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </details>
        )}

        <Card className="shadow-xl border-none">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Access your personalised career tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {/* Google OAuth */}
            <Button
              variant="outline"
              className="w-full h-12 font-semibold text-base border-2 disabled:opacity-60"
              onClick={googleReady
                ? () => loginWithGoogle(localStorage.getItem("edubharat_guest_id") ?? undefined)
                : copyCallbackUrl}
              title={!googleReady ? "Google login not yet configured — see setup instructions above" : undefined}
              data-testid="button-google-login"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleReady ? "Continue with Google" : "Google Sign-In (not configured)"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {step === "email" ? (
              <div className="space-y-3">
                {config?.otpDevMode && (
                  <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded p-2.5">
                    <strong>Dev mode:</strong> OTP email not configured (no <code>RESEND_API_KEY</code>). The 6-digit code will appear on screen after you click Send OTP.
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    className="h-12 pl-10"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                    data-testid="input-email"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full h-12 font-bold" onClick={handleSendOtp} disabled={loading} data-testid="button-send-otp">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Send OTP
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    OTP sent to <span className="font-semibold text-secondary">{email}</span>
                  </p>
                  {devCode && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700 mb-1">Dev mode — your code is:</p>
                      <p className="text-3xl font-bold tracking-[0.4em] text-amber-900">{devCode}</p>
                      <p className="text-xs text-amber-600 mt-1">Configure RESEND_API_KEY to send real emails</p>
                    </div>
                  )}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit OTP"
                  className="h-12 text-center text-2xl font-bold tracking-[0.5em]"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                  data-testid="input-otp"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full h-12 font-bold" onClick={handleVerifyOtp} disabled={loading || otp.length < 6} data-testid="button-verify-otp">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  Verify & Sign In
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => { setStep("email"); setOtp(""); setError(""); }}>
                  ← Use different email
                </Button>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our Terms of Service.{" "}
              <span className="text-muted-foreground/60">Your data is stored securely.</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
