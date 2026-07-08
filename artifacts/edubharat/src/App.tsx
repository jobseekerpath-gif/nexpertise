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
const AdminContent = lazy(() => import("@/pages/admin-content"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
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
            <Route path="/admin-content" component={AdminContent} />
            <Route path="/admin" component={AdminPayments} />
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
