import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "./empty-state";
import { useCareerAnalytics } from "@/lib/use-career-analytics";
import { useAuth } from "@/lib/use-auth";
import { useLocation } from "wouter";
import { Briefcase, FileText, User, ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offered: "Offered",
  rejected: "Not selected",
};

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-700 border-slate-200",
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  interviewing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  offered: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

export function CareerTab() {
  const career = useCareerAnalytics();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [updating, setUpdating] = useState<string | null>(null);
  const [jobs, setJobs] = useState(career.savedJobs);

  // Keep local UI state in sync if career hook refreshes
  useEffect(() => { setJobs(career.savedJobs); }, [career.savedJobs]);

  const updateStatus = async (jobId: string, status: string) => {
    if (!user) return;
    setUpdating(jobId);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/jobs/save/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ applicationStatus: status }),
      });
      if (res.ok) {
        setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, applicationStatus: status } : j));
      }
    } finally {
      setUpdating(null);
    }
  };

  const hasAnyData = career.savedJobsCount > 0 || career.resumeScore !== null || career.profileCompletion > 0;

  if (!hasAnyData) {
    return (
      <EmptyState
        emoji="💼"
        title="Build your career profile"
        description="Upload your resume, save jobs from Rozgar Samachar, and track your applications here."
        actionLabel="Explore Jobs"
        actionHref="/rozgar-samachar"
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Top row: saved jobs + resume + profile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="text-xl font-display font-bold text-secondary">{career.savedJobsCount}</div>
            <div className="text-xs font-semibold text-secondary">Saved Jobs</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-xl font-display font-bold text-secondary">{career.resumeScore ?? "—"}</div>
            <div className="text-xs font-semibold text-secondary">Resume Score</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
              <User className="w-4 h-4" />
            </div>
            <div className="text-xl font-display font-bold text-secondary">{career.profileCompletion}%</div>
            <div className="text-xs font-semibold text-secondary">Profile Complete</div>
          </CardContent>
        </Card>
      </div>

      {/* Profile completion nudge */}
      {career.profileCompletion < 100 && (
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-secondary">Complete your profile</p>
                <p className="text-xs text-muted-foreground">A complete profile powers better job matches and AI coaching.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>Go to Profile</Button>
            </div>
            <Progress value={career.profileCompletion} className="h-2 mt-3" />
          </CardContent>
        </Card>
      )}

      {/* Resume score badge */}
      {career.resumeScore !== null && (
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${career.resumeScore >= 80 ? "bg-green-100 text-green-700" : career.resumeScore >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                {career.resumeScore}%
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary">Resume readiness</p>
                <p className="text-xs text-muted-foreground">
                  {career.resumeScore >= 80 ? "Great shape for ATS and recruiters." : "Visit Resume Intelligence to improve your score."}
                </p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/resume-intelligence")}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application tracker */}
      {career.savedJobsCount > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Application Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.jobId} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-secondary truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.company ?? job.source ?? "Unknown company"}</p>
                  </div>
                  {user ? (
                    <Select
                      value={job.applicationStatus ?? "saved"}
                      onValueChange={v => updateStatus(job.jobId, v)}
                      disabled={updating === job.jobId}
                    >
                      <SelectTrigger className="h-8 text-xs w-32 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {STATUS_LABELS[job.applicationStatus ?? "saved"]}
                    </Badge>
                  )}
                  <a href={job.link} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-primary">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
