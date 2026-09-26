import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Announcements from "@/pages/Announcements";
import AccessPending from "@/pages/AccessPending";
import Documents from "@/pages/Documents";
import Home from "@/pages/Home";
import Invite from "@/pages/Invite";
import Invites from "@/pages/Invites";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicHome from "@/pages/PublicHome";
import Responsibles from "@/pages/Responsibles";
import Tickets from "@/pages/Tickets";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, loading, user } = useAuth();
  const overview = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  if (location === "/invite" || location.startsWith("/invite/")) return <Invite />;
  if (loading || (isAuthenticated && overview.isLoading)) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) return <PublicHome />;
  if (user?.role !== "admin" && overview.data && !overview.data.scope) return <AccessPending />;

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/documents" component={Documents} />
        <Route path="/invites" component={Invites} />
        <Route path="/profile" component={Profile} />
        <Route path="/responsibles" component={Responsibles} />
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
