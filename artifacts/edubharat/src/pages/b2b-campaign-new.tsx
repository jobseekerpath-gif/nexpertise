import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Briefcase, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const INTERVIEW_TYPES = [
  { value: "hr", label: "HR Interview" },
  { value: "software", label: "Software Developer" },
  { value: "sales", label: "Sales Executive" },
  { value: "marketing", label: "Marketing Manager" },
  { value: "customer_service", label: "Customer Service" },
  { value: "banking", label: "Banking / BFSI" },
  { value: "insurance", label: "Insurance" },
  { value: "operations", label: "Operations" },
  { value: "data_analytics", label: "Data Analytics" },
  { value: "finance", label: "Finance / CA" },
  { value: "freshers", label: "Freshers / Campus" },
  { value: "government", label: "Government / SSC / UPSC" },
];

const EXPERIENCE_LEVELS = ["Fresher", "1-2 years", "3-5 years", "5+ years"];

const COACHES = [
  { id: "raj", name: "Raj Kumar" },
  { id: "priya", name: "Priya Sharma" },
  { id: "arjun", name: "Arjun Mehta" },
  { id: "meera", name: "Meera Iyer" },
  { id: "rohit", name: "Rohit Verma" },
];

const DURATIONS = [
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 25, label: "25 minutes" },
  { value: 30, label: "30 minutes" },
];

export default function B2BCampaignNew() {
  const { company, isLoading } = useB2BAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    role: "",
    experienceLevel: "Fresher",
    interviewType: "hr",
    coachId: "raj",
    durationMinutes: 15,
    description: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.role.trim()) {
      toast({ title: "Title and role are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { campaign?: { id: number }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create campaign");
      toast({ title: "Campaign created!" });
      navigate(`/b2b/campaign/${data.campaign!.id}`);
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!company) { navigate("/b2b/login"); return null; }

  return (
    <div className="container mx-auto px-4 max-w-2xl py-8">
      <PageMeta title="New Campaign · B2B · EduBharat" description="Create an interview campaign" />
      <B2BNav />

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/b2b/campaigns")} className="text-muted-foreground hover:text-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-secondary">New Campaign</h1>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 px-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Campaign title *</label>
                <Input value={form.title} onChange={set("title")} placeholder="e.g. Sales Hiring Q3 2025" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Role / Position *</label>
                <Input value={form.role} onChange={set("role")} placeholder="e.g. Sales Executive" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Experience level</label>
                <select value={form.experienceLevel} onChange={set("experienceLevel")}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary">
                  {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Interview type</label>
                <select value={form.interviewType} onChange={set("interviewType")}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary">
                  {INTERVIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">AI Interviewer</label>
                <select value={form.coachId} onChange={set("coachId")}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary">
                  {COACHES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-secondary mb-1 block">Interview duration</label>
                <select value={form.durationMinutes} onChange={setNum("durationMinutes")}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary">
                  {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-secondary mb-1 block">Job description (optional)</label>
              <textarea
                value={form.description}
                onChange={set("description")}
                placeholder="Brief description of the role, requirements, or anything the AI interviewer should focus on…"
                rows={3}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p>Each candidate who completes this interview will cost <strong className="text-secondary">2 credits</strong> from your balance.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => navigate("/b2b/campaigns")}>Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 font-bold">
                {loading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Creating…</> : "Create campaign →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
