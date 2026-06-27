import { useState, useEffect } from "react";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { User, GraduationCap, Briefcase, MapPin, Mic, BookOpen, CheckCircle, LogIn, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";

const INDIAN_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Gujarati", "Punjabi", "Bengali", "Odia"];
const DEGREES = ["10th Pass", "12th Pass", "ITI", "Diploma", "B.A.", "B.Com.", "B.Sc.", "B.Tech.", "BBA", "BCA", "M.A.", "M.Com.", "M.Sc.", "M.Tech.", "MBA", "MCA", "Ph.D.", "Other"];
const EXPERIENCE_LEVELS = ["Fresher", "< 1 year", "1-2 years", "2-3 years", "3-5 years", "5-8 years", "8+ years"];
const ENGLISH_LEVELS = ["Beginner (A1)", "Basic (A2)", "Intermediate (B1)", "Upper-Intermediate (B2)", "Advanced (C1)", "Mastery (C2)"];
const CAREER_GOALS = ["Private Job", "Government Job", "Startup", "Own Business", "Freelancing", "Higher Studies", "Internship"];
const INDUSTRIES = ["Technology / IT", "Banking / Finance", "Healthcare", "Education", "Marketing", "Operations / Logistics", "Sales", "Manufacturing", "Government / Public Sector", "Other"];
const VOICE_STYLES = [
  { value: "priya", label: "Priya Ma'am (Female, Friendly)" },
  { value: "rohit", label: "Rohit Sir (Male, Professional)" },
  { value: "meera", label: "Meera Ma'am (Female, Calm)" },
  { value: "arjun", label: "Arjun Sir (Male, Energetic)" },
  { value: "rahul", label: "Rahul Sir (Male, Clear)" },
];

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-base font-bold text-secondary">{title}</h2>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageMeta title="My Profile" description="Update your EduBharat profile, skills, and career preferences to get personalised coaching and job matches." />
      <ProfilePageContent />
    </>
  );
}

function ProfilePageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, updateProfile, completionPct } = useStudentProfile();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");

  // Local form state initialised from profile
  const [form, setForm] = useState({ ...profile });
  useEffect(() => { setForm({ ...profile }); }, [profile]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <div className="text-6xl mb-6">👤</div>
        <h1 className="text-2xl font-display font-bold text-secondary mb-3">Sign in to edit your profile</h1>
        <p className="text-muted-foreground mb-6">Your profile personalises English Guru, Interview Ace, and job recommendations.</p>
        <Button onClick={() => navigate("/login")} className="w-full font-bold">
          <LogIn className="w-4 h-4 mr-2" />Sign In
        </Button>
      </div>
    );
  }

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s || form.skills.includes(s)) return;
    set("skills", [...form.skills, s]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    set("skills", form.skills.filter(s => s !== skill));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile(form);
      toast({ title: "Profile saved!", description: "Your profile has been updated." });
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalise your EduBharat experience</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground mb-1">Profile complete</div>
          <div className="flex items-center gap-2">
            <Progress value={completionPct} className="w-32 h-2" />
            <span className="text-sm font-bold text-primary">{completionPct}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Personal Info */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionTitle icon={User} title="Personal Information" />
          </CardHeader>
          <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Language</Label>
              <Select value={form.preferredLanguage} onValueChange={v => set("preferredLanguage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>English Level</Label>
              <Select value={form.englishLevel} onValueChange={v => set("englishLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENGLISH_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Education */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionTitle icon={GraduationCap} title="Education" />
          </CardHeader>
          <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Highest Degree</Label>
              <Select value={form.degree} onValueChange={v => set("degree", v)}>
                <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
                <SelectContent>
                  {DEGREES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch / Subject</Label>
              <Input id="branch" value={form.branch} onChange={e => set("branch", e.target.value)} placeholder="e.g. Computer Science" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="university">College / University</Label>
              <Input id="university" value={form.university} onChange={e => set("university", e.target.value)} placeholder="e.g. Delhi University" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="graduationYear">Graduation Year</Label>
              <Input id="graduationYear" value={form.graduationYear} onChange={e => set("graduationYear", e.target.value)} placeholder="e.g. 2024" />
            </div>
          </CardContent>
        </Card>

        {/* Career */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionTitle icon={Briefcase} title="Career Goals" />
          </CardHeader>
          <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Career Goal</Label>
              <Select value={form.careerGoal} onValueChange={v => set("careerGoal", v)}>
                <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                <SelectContent>
                  {CAREER_GOALS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredRole">Preferred Role / Job Title</Label>
              <Input id="preferredRole" value={form.preferredRole} onChange={e => set("preferredRole", e.target.value)} placeholder="e.g. Software Engineer" />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industryPreference} onValueChange={v => set("industryPreference", v)}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Experience Level</Label>
              <Select value={form.experienceLevel} onValueChange={v => set("experienceLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Location & Salary */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionTitle icon={MapPin} title="Location & Salary" />
          </CardHeader>
          <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="preferredCity">Preferred City</Label>
              <Input id="preferredCity" value={form.preferredCity} onChange={e => set("preferredCity", e.target.value)} placeholder="e.g. Bengaluru" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedSalary">Expected Salary (per year)</Label>
              <Input id="expectedSalary" value={form.expectedSalary} onChange={e => set("expectedSalary", e.target.value)} placeholder="e.g. ₹4-6 LPA" />
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionTitle icon={CheckCircle} title="Skills" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex gap-2 mb-3">
              <Input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="Type a skill and press Enter"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addSkill} className="shrink-0 min-h-11 min-w-11">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {form.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">Add your top skills — they help match you with the right jobs.</p>
            )}
          </CardContent>
        </Card>

        {/* Voice & Preferences */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              Voice & Learning Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Preferred AI Teacher</Label>
              <Select value={form.preferredTutor} onValueChange={v => set("preferredTutor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Voice Style</Label>
              <Select value={form.voiceStyle} onValueChange={v => set("voiceStyle", v as typeof form.voiceStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate(-1 as unknown as string)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="font-bold min-w-[120px]">
            {saving ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</span>
            ) : (
              <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" />Save Profile</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
