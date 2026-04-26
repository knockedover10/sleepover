import { useEffect, useState, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  Home,
  CalendarDays,
  Map as MapIcon,
  Wallet,
  ListChecks,
  FolderClosed,
  ChevronDown,
  Share2,
  Copy,
  Check,
  Sun,
  Moon,
  Settings2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useTripCtx } from "@/lib/trip-context";
import { useTripData } from "@/lib/trip-data";
import { supabase } from "@/lib/supabase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TRAVELER_COLORS = ["#2c7273", "#c25e2a", "#c89b32", "#7a5da6", "#1f6f54", "#a8453d"];

function tabs(token: string) {
  return [
    { path: `/t/${token}`, label: "Trip", icon: Home, testid: "tab-overview" },
    {
      path: `/t/${token}/itinerary`,
      label: "Plan",
      icon: CalendarDays,
      testid: "tab-itinerary",
    },
    { path: `/t/${token}/map`, label: "Map", icon: MapIcon, testid: "tab-map" },
    { path: `/t/${token}/budget`, label: "Budget", icon: Wallet, testid: "tab-budget" },
    { path: `/t/${token}/tasks`, label: "Tasks", icon: ListChecks, testid: "tab-tasks" },
    { path: `/t/${token}/documents`, label: "Docs", icon: FolderClosed, testid: "tab-documents" },
  ];
}

function Avatar({
  name,
  initials,
  color,
  size = 28,
  ring = false,
  className,
}: {
  name: string;
  initials: string;
  color: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        ring && "ring-2 ring-card",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(10, size * 0.4),
      }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export function TravelerStack({
  size = 28,
  showLive = true,
}: {
  size?: number;
  showLive?: boolean;
}) {
  const { travelers } = useTripData();
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {travelers.map((t) => (
          <Avatar key={t.id} {...t} size={size} ring data-testid={`avatar-${t.id}`} />
        ))}
      </div>
      {showLive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="ios-tap ml-2 flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
              data-testid="indicator-live"
              aria-label="Real-time sync indicator"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            Real-time sync — others' updates appear instantly.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ShareSheet({ children }: { children: ReactNode }) {
  const { trip } = useTripData();
  const [copied, setCopied] = useState(false);
  const url = trip?.shareUrl || "";
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Share trip</SheetTitle>
          <SheetDescription>
            Invite people via this link. They'll see what you share.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border bg-muted/50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm" data-testid="text-share-url">
                {url}
              </p>
            </div>
            <Button
              size="sm"
              variant={copied ? "secondary" : "default"}
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              data-testid="button-copy-link"
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with the link can view & edit. Treat it like a password.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TopHeader({
  onToggleTheme,
  isDark,
}: {
  onToggleTheme: () => void;
  isDark: boolean;
}) {
  const { trip, inviteToken } = useTripData();
  const tripName = trip?.name || "Sleepover";
  const dest = trip?.destination || "";
  return (
    <header className="sticky top-0 z-30 ios-blur bg-background/80 border-b border-border/60">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2.5">
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="ios-tap flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-left hover-elevate"
              data-testid="button-trip-switcher"
            >
              <span className="truncate text-[15px] font-semibold">{tripName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Trip menu</SheetTitle>
              <SheetDescription>
                Manage this trip or switch to another one.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
                <div>
                  <p className="font-semibold">{tripName}</p>
                  <p className="text-xs text-muted-foreground">{dest}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Active
                </span>
              </div>
              <Link
                href={inviteToken ? `/t/${inviteToken}/settings` : "/"}
                className="ios-tap flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover-elevate"
                data-testid="button-open-settings"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Trip settings</span>
              </Link>
              <Link
                href="/"
                className="ios-tap flex w-full items-center gap-2 rounded-2xl border border-dashed bg-card p-3 text-left hover-elevate text-muted-foreground"
                data-testid="button-back-to-trips"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">All trips / new</span>
              </Link>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5">
          <TravelerStack />
          <button
            className="ios-tap ml-1 grid h-9 w-9 place-items-center rounded-full hover-elevate"
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            data-testid="button-theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <ShareSheet>
            <button
              className="ios-tap grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Share trip"
              data-testid="button-share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </ShareSheet>
        </div>
      </div>
    </header>
  );
}

function BottomTabBar() {
  const [location, setLocation] = useLocation();
  const { inviteToken } = useTripCtx();
  if (!inviteToken) return null;
  const TABS = tabs(inviteToken);
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 ios-blur bg-background/85 border-t border-border/60"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <div className="flex items-stretch justify-between px-2 py-1.5">
        {TABS.map((t) => {
          const active =
            location === t.path ||
            (t.path === `/t/${inviteToken}` && location === `/t/${inviteToken}/`);
          const Icon = t.icon;
          return (
            <button
              key={t.path}
              onClick={() => setLocation(t.path)}
              className={cn(
                "ios-tap flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 hover-elevate",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              data-testid={t.testid}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
              <span
                className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main
      className="tab-fade mx-auto max-w-md px-4 pt-3"
      style={{
        minHeight: "calc(100dvh - 56px)",
        paddingBottom: "calc(80px + max(env(safe-area-inset-bottom), 0px))",
      }}
    >
      {children}
    </main>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/40 sm:py-6">
      <div className="mx-auto max-w-md sm:rounded-[2.5rem] sm:bg-background sm:shadow-2xl sm:overflow-hidden sm:ring-1 sm:ring-border/40">
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleTheme = () => {
    setIsDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  return (
    <PhoneFrame>
      <TopHeader onToggleTheme={toggleTheme} isDark={isDark} />
      {children}
      <BottomTabBar />
    </PhoneFrame>
  );
}

// ── Loading + JoinPrompt + NotFound shells ────────────────────────────

export function LoadingShell({ message = "Loading..." }: { message?: string }) {
  return (
    <PhoneFrame>
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{message}</p>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function TripNotFoundShell() {
  return (
    <PhoneFrame>
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <h1 className="text-2xl font-bold">Trip not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite link may be expired, invalid, or the trip was deleted.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          data-testid="link-home"
        >
          Back to home
        </Link>
      </div>
    </PhoneFrame>
  );
}

export function JoinPromptShell() {
  const { trip, inviteToken, deviceId, refetch } = useTripCtx();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TRAVELER_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!name.trim() || !inviteToken || !deviceId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("join_trip", {
        p_token: inviteToken,
        p_name: name.trim(),
        p_color: color,
        p_device_id: deviceId,
      });
      if (error) throw error;
      refetch();
    } catch (e: any) {
      toast({ title: "Could not join", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneFrame>
      <div className="mx-auto max-w-md px-6 pt-12 pb-20">
        <h1 className="text-2xl font-bold tracking-tight">
          Join "{trip?.name || "this trip"}"
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a name & color. Other travelers will see this.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="jname">Your name</Label>
            <Input
              id="jname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liew"
              data-testid="input-join-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TRAVELER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "ios-tap h-9 w-9 rounded-full ring-2",
                    color === c ? "ring-foreground" : "ring-transparent"
                  )}
                  data-testid={`button-color-${c.replace("#", "")}`}
                />
              ))}
            </div>
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={!name.trim() || busy}
            data-testid="button-join"
          >
            {busy ? "Joining..." : "Join trip"}
          </Button>
        </form>
      </div>
    </PhoneFrame>
  );
}

// Re-usable bits exported for pages
export { Avatar };
