import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Building2, CheckCircle2, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";

const INDUSTRIES = [
  "Technology", "Banking / Finance", "Insurance", "Healthcare",
  "Manufacturing", "Retail / E-commerce", "Consulting", "Education",
  "Real Estate", "Government / PSU", "Other",
];

export default function B2BRegister() {
  const [, navigate] = useLocation();
  const { register } = useB2BAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm: "",
    phone: "", industry: "", website: "",
  });
  const [isAnonymous, setIsAnonymous] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        industry: form.industry || undefined,
        website: form.website.trim() || undefined,
        isAnonymous,
      });
      toast({ title: "Welcome to EduBharat B2B!" });
      navigate("/b2b/dashboard");
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <PageMeta title="Register · B2B Portal · EduBharat" description="Create your B2B account" />
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-secondary">Register your company</h1>
            <p className="text-sm text-muted-foreground mt-1">Start sending AI interview links in minutes</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Company name *</label>
              <Input value={form.name} onChange={set("name")} placeholder="Acme Corp" required />
            </div>
            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Company email *</label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="hr@company.com" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Password *</label>
                <Input type="password" value={form.password} onChange={set("password")} placeholder="Min 8 chars" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Confirm *</label>
                <Input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Phone</label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Industry</label>
                <select
                  value={form.industry}
                  onChange={set("industry")}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select…</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Website</label>
              <Input value={form.website} onChange={set("website")} placeholder="https://company.com" />
            </div>

            {/* ── Anonymity toggle ── */}
            <button
              type="button"
              onClick={() => setIsAnonymous((v) => !v)}
              className={`w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                isAnonymous
                  ? "border-violet-400 bg-violet-50"
                  : "border-border bg-muted/30 hover:border-muted-foreground/40"
              }`}
            >
              <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isAnonymous ? "border-violet-500 bg-violet-500" : "border-muted-foreground/40"
              }`}>
                {isAnonymous && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isAnonymous ? (
                    <EyeOff className="w-4 h-4 text-violet-600 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <p className={`text-sm font-semibold ${isAnonymous ? "text-violet-700" : "text-secondary"}`}>
                    Keep company name confidential
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Candidates will see <span className="font-semibold">"Confidential Company"</span> instead of your real name on their interview invitation. Your identity is only visible inside your dashboard.
                </p>
              </div>
            </button>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />2 credits per completed interview</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />Unlimited campaigns and invite links</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />Full score breakdown + Selected/Not Selected verdict</p>
            </div>

            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : "Create account →"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/b2b/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
