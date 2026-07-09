import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { PageSkeleton } from "@/components/page-skeleton";
import { reportWebVitals } from "@/lib/web-vitals";
import { trackPageView } from "@/lib/analytics";

const queryClient = new QueryClient();

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const EnglishGuru = lazy(() => import("@/pages/english-guru"));
const ToolsPro = lazy(() => import("@/pages/tools-pro"));
const InterviewAce = lazy(() => import("@/pages/interview-ace"));
const RozgarSamachar = lazy(() => import("@/pages/rozgar-samachar"));
const ResumeIntelligence = lazy(() => import("@/pages/resume-intelligence"));
const LearningJourney = lazy(() => import("@/pages/learning-journey"));
const History = lazy(() => import("@/pages/history"));
const Login = lazy(() => import("@/pages/login"));
const Progress = lazy(() => import("@/pages/progress"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const BuyCredits = lazy(() => import("@/pages/buy-credits"));
const AdminPayments = lazy(() => import("@/pages/admin-payments"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminInterviews = lazy(() => import("@/pages/admin-interviews"));
const AdminB2B = lazy(() => import("@/pages/admin-b2b"));
const AdminContent = lazy(() => import("@/pages/admin-content"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
// B2B portal
const B2BLogin = lazy(() => import("@/pages/b2b-login"));
const B2BRegister = lazy(() => import("@/pages/b2b-register"));
const B2BDashboard = lazy(() => import("@/pages/b2b-dashboard"));
const B2BCampaigns = lazy(() => import("@/pages/b2b-campaigns"));
const B2BCampaignNew = lazy(() => import("@/pages/b2b-campaign-new"));
const B2BCampaign = lazy(() => import("@/pages/b2b-campaign"));
const B2BCandidates = lazy(() => import("@/pages/b2b-candidates"));
const B2BCredits = lazy(() => import("@/pages/b2b-credits"));
const B2BInterviewLanding = lazy(() => import("@/pages/b2b-interview-landing"));
const Terms = lazy(() => import("@/pages/terms"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const ShippingRefund = lazy(() => import("@/pages/shipping-refund"));
const AboutUs = lazy(() => import("@/pages/about-us"));
const ContactUs = lazy(() => import("@/pages/contact-us"));

function Analytics() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/english-guru">
        <Layout compact showFooter={false}>
          <EnglishGuru />
        </Layout>
      </Route>
      <Route path="/interview-ace">
        <Layout compact showFooter={false}>
          <InterviewAce />
        </Layout>
      </Route>
      <Route path="/rozgar-samachar">
        <Layout compact showFooter={false}>
          <RozgarSamachar />
        </Layout>
      </Route>
      <Route path="/resume-intelligence">
        <Layout compact showFooter={false}>
          <ResumeIntelligence />
        </Layout>
      </Route>
      <Route path="/learning-journey">
        <Layout>
          <LearningJourney />
        </Layout>
      </Route>
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/tools-pro" component={ToolsPro} />
            <Route path="/history" component={History} />
            <Route path="/login" component={Login} />
            <Route path="/progress" component={Progress} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/credits" component={BuyCredits} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/shipping-refund" component={ShippingRefund} />
            <Route path="/about-us" component={AboutUs} />
            <Route path="/contact-us" component={ContactUs} />
            <Route path="/admin-login" component={AdminLogin} />
            <Route path="/admin-payments" component={AdminPayments} />
            <Route path="/admin-users" component={AdminUsers} />
            <Route path="/admin-interviews" component={AdminInterviews} />
            <Route path="/admin-b2b" component={AdminB2B} />
            <Route path="/admin-content" component={AdminContent} />
            <Route path="/admin" component={AdminPayments} />
            {/* B2B portal */}
            <Route path="/b2b/login" component={B2BLogin} />
            <Route path="/b2b/register" component={B2BRegister} />
            <Route path="/b2b/dashboard" component={B2BDashboard} />
            <Route path="/b2b/campaigns" component={B2BCampaigns} />
            <Route path="/b2b/campaign/new" component={B2BCampaignNew} />
            <Route path="/b2b/campaign/:id" component={B2BCampaign} />
            <Route path="/b2b/candidates" component={B2BCandidates} />
            <Route path="/b2b/credits" component={B2BCredits} />
            <Route path="/b2b-interview/:token" component={B2BInterviewLanding} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Analytics />
            <Suspense fallback={<PageSkeleton />}>
              <Router />
            </Suspense>
            <Toaster />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
