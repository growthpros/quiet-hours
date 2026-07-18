import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rollOverPreviousTodayTasks } from "@/lib/tasks-data";
import { resolveRecurringInstances } from "@/lib/recurring-resolver";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotFound from "@/pages/not-found";
import SignIn from "@/pages/sign-in";
import Today from "@/pages/today";
import Foundation from "@/pages/foundation";
import EarnBack from "@/pages/earn-back";
import Delegation from "@/pages/delegation";
import Tasks from "@/pages/tasks";
import Recurring from "@/pages/recurring";
import BrainDump from "@/pages/brain-dump";
import GoodEnough from "@/pages/good-enough";
import Reframes from "@/pages/reframes";
import Compassion from "@/pages/compassion";
import Burnout from "@/pages/burnout";
import History from "@/pages/history";
import Settings from "@/pages/settings";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Today} />
      <Route path="/foundation" component={Foundation} />
      <Route path="/earn-back" component={EarnBack} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/recurring" component={Recurring} />
      <Route path="/brain-dump" component={BrainDump} />
      <Route path="/delegation" component={Delegation} />
      <Route path="/good-enough" component={GoodEnough} />
      <Route path="/reframes" component={Reframes} />
      <Route path="/compassion" component={Compassion} />
      <Route path="/burnout" component={Burnout} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthedShell() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.25rem",
  };
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="mx-auto w-full max-w-6xl px-5 py-8 pb-24 sm:px-8 md:pb-10">
                <AppRouter />
                <SiteFooter />
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
      <BottomNav />
      <WelcomeDialog />
    </SidebarProvider>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();
  const qc = useQueryClient();

  // On sign-in: roll incomplete 'today' tasks forward, then resolve
  // recurring templates to generate any due instances. Both are
  // idempotent; safe to retry on every mount.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const rolled = await rollOverPreviousTodayTasks();
        if (rolled > 0) {
          qc.invalidateQueries({ queryKey: ["tasks"] });
          qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[rollover] failed", e);
      }

      try {
        const result = await resolveRecurringInstances();
        if (result.instancesCreated > 0) {
          qc.invalidateQueries({ queryKey: ["tasks"] });
          qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
        }
        if (result.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.warn("[recurring-resolver] partial errors", result.errors);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[recurring-resolver] failed", e);
      }
    })();
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-serif text-sm italic text-muted-foreground">
          One moment…
        </div>
      </div>
    );
  }
  if (!session) return <SignIn />;
  return <AuthedShell />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router hook={useHashLocation}>
              <AuthGate />
            </Router>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
