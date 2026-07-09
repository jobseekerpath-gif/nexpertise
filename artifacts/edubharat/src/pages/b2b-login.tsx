import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Building2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";

export default function B2BLogin() {
  const [, navigate] = useLocation();
  const { login } = useB2BAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/b2b/dashboard");
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <PageMeta title="B2B Portal Login · EduBharat" description="Sign in to your EduBharat recruiter portal" />
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-secondary">Recruiter Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your B2B account</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Company email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="company@example.com"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
            </div>

            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : <><KeyRound className="w-4 h-4 mr-2" />Sign in</>}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            No account?{" "}
            <Link href="/b2b/register" className="text-primary font-semibold hover:underline">
              Register your company
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-3">
            <Link href="/" className="hover:underline">← Back to EduBharat</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
