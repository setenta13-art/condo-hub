import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Announcements from "@/pages/Announcements";
import Documents from "@/pages/Documents";
import Home from "@/pages/Home";
import Invite from "@/pages/Invite";
import Invites from "@/pages/Invites";
import NotFound from "@/pages/NotFound";
import Tickets from "@/pages/Tickets";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  const [location] = useLocation();
  if (location.startsWith("/invite/")) return <Invite />;

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/documents" component={Documents} />
        <Route path="/invites" component={Invites} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
