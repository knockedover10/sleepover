import { Switch, Route, Router, useRoute } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TripProvider, useTripCtx } from "@/lib/trip-context";
import {
  AppShell,
  LoadingShell,
  TripNotFoundShell,
  JoinPromptShell,
} from "@/components/AppShell";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Overview from "@/pages/Overview";
import Itinerary from "@/pages/Itinerary";
import MapView from "@/pages/MapView";
import Budget from "@/pages/Budget";
import Tasks from "@/pages/Tasks";
import Documents from "@/pages/Documents";
import Settings from "@/pages/Settings";
import type { ComponentType } from "react";

function TripGate({ children }: { children: React.ReactNode }) {
  const { trip, isLoading, isJoinPrompt, inviteToken } = useTripCtx();
  if (isLoading) return <LoadingShell />;
  if (!trip) return <TripNotFoundShell />;
  if (isJoinPrompt) return <JoinPromptShell />;
  return <AppShell>{children}</AppShell>;
}

function TripRoute({
  Component,
}: {
  Component: ComponentType;
}) {
  // Match either /t/:token or /t/:token/<sub>
  const [, params] = useRoute<{ token: string }>("/t/:token/*?");
  const [, paramsBase] = useRoute<{ token: string }>("/t/:token");
  const inviteToken = params?.token || paramsBase?.token || null;

  return (
    <TripProvider inviteToken={inviteToken}>
      <TripGate>
        <Component />
      </TripGate>
    </TripProvider>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/t/:token">
        {() => <TripRoute Component={Overview} />}
      </Route>
      <Route path="/t/:token/itinerary">
        {() => <TripRoute Component={Itinerary} />}
      </Route>
      <Route path="/t/:token/map">
        {() => <TripRoute Component={MapView} />}
      </Route>
      <Route path="/t/:token/budget">
        {() => <TripRoute Component={Budget} />}
      </Route>
      <Route path="/t/:token/tasks">
        {() => <TripRoute Component={Tasks} />}
      </Route>
      <Route path="/t/:token/documents">
        {() => <TripRoute Component={Documents} />}
      </Route>
      <Route path="/t/:token/settings">
        {() => <TripRoute Component={Settings} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
