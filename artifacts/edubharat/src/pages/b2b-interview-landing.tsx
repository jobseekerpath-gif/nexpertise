import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Briefcase, Clock, User, PlayCircle, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageMeta } from "@/components/page-meta";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type InviteInfo = {
  id: number;
  status: string;
  candidateName: string | null;
  candidateEmail: string | null;
  campaignTitle: string;
  campaignRole: string;
  experienceLevel: string;
  interviewType: string;
  coachId: string;
  durationMinutes: number;
  description: string | null;
  companyName: string;
};

const TYPE_LABELS: Record<string, string> = {
  hr: "HR Interview", software: "Software Developer", sales: "Sales Executive",
  marketing: "Marketing Manager", customer_service: "Customer Service",
  banking: "Banking / BFSI", insurance: "Insurance", operations: "Operations",
  data_analytics: "Data Analytics", finance: "Finance / CA",
  freshers: "Freshers / Campus", government: "Government / SSC / UPSC",
};

export default function B2BInterviewLanding() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const token = params.token;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(`${BASE}/api/b2b/invite/${token}/info`, { credentials: "include" });
        const data = (await res.json()) as { invite?: InviteInfo; error?: string };
        if (!res.ok) { setError(data.error ?? "Invite not found"); return; }
        setInvite(data.invite!);
        if (data.invite!.candidateName) setCandidateName(data.invite!.candidateName);
      } catch {
        setError("Could not load invite details. Please check your link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const startInterview = async () => {
    if (!invite) return;
    setStarting(true);
    try {
      await fetch(`${BASE}/api/b2b/invite/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ candidateName: candidateName.trim() || undefined }),
      });
    } catch { /* best-effort */ }

    // Build URL params for interview-ace
    const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const params = new URLSearchParams({
      b2bToken: token,
      b2bType: invite.interviewType,
      b2bDuration: String(invite.durationMinutes),
      b2bCoach: invite.coachId,
    });
    window.location.href = `${baseUrl}/interview-ace?${params.toString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-secondary mb-2">Link Unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite?.status === "completed") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-secondary mb-2">Interview Completed</h1>
            <p className="text-sm text-muted-foreground">You have already completed this interview. Your results have been shared with the company.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <PageMeta
        title={`Interview Invitation — ${invite.campaignRole} · EduBharat`}
        description={`You've been invited to interview for ${invite.campaignRole} at ${invite.companyName}`}
      />
      <Card className="w-full max-w-lg shadow-xl">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Company badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{invite.companyName}</p>
            <h1 className="text-2xl font-display font-bold text-secondary mt-1">Interview Invitation</h1>
          </div>

          {/* Role details */}
          <div className="bg-muted/50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-bold text-secondary">{invite.campaignRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Duration · Type</p>
                <p className="font-semibold text-secondary">{invite.durationMinutes} minutes · {TYPE_LABELS[invite.interviewType] ?? invite.interviewType}</p>
              </div>
            </div>
            {invite.description && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">About the role</p>
                  <p className="text-sm text-secondary">{invite.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Name input */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-secondary mb-1.5 block">Your name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Enter your full name"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6 text-xs text-blue-700 space-y-1">
            <p className="font-semibold text-blue-800 mb-1">Before you begin:</p>
            <p>✓ Find a quiet space with no distractions</p>
            <p>✓ Use Chrome or Edge for the best voice experience</p>
            <p>✓ Allow microphone access when prompted</p>
            <p>✓ The interview is fully AI-powered and takes {invite.durationMinutes} minutes</p>
          </div>

          <Button
            className="w-full font-bold text-base py-5"
            onClick={() => void startInterview()}
            disabled={starting}
          >
            {starting
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing interview…</>
              : <><PlayCircle className="w-5 h-5 mr-2" />Start Interview</>}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Powered by <span className="font-semibold text-primary">EduBharat</span> · AI-powered mock interviews
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
