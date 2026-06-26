import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EnglishGuru from "@/pages/english-guru";
import InterviewAce from "@/pages/interview-ace";
import RozgarSamachar from "@/pages/rozgar-samachar";
import History from "@/pages/history";
import Login from "@/pages/login";
import Progress from "@/pages/progress";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/english-guru">
        <Layout compact showFooter={false}>
          <EnglishGuru />
        </Layout>
      </Route>
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/interview-ace" component={InterviewAce} />
            <Route path="/rozgar-samachar" component={RozgarSamachar} />
            <Route path="/history" component={History} />
            <Route path="/login" component={Login} />
            <Route path="/progress" component={Progress} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
