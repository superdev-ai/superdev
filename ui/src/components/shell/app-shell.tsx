/**
 * The persistent frame every view sits inside.
 *
 * Chassis on the left, header across the top, one scroll container for the
 * view. The rail collapses into a sheet below the large breakpoint so the same
 * navigation works on a narrow phone. Nothing here fetches project data: the
 * shell is given what it shows, so it stays the stable part of the application
 * while views come and go.
 */

import {
  Activity,
  ClipboardCheck,
  Compass,
  Database,
  Gauge,
  GitCompare,
  Layers,
  ListChecks,
  Map,
  Menu,
  Monitor,
  MonitorSmartphone,
  Moon,
  Network,
  Plug,
  Scale,
  Search,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Target,
  type LucideIcon,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import type * as React from "react";

import logoUrl from "@/assets/logo.png?inline";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarGroupLabel,
  SidebarItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatus } from "@/components/shell/status";
import { THEME_LABELS, useTheme, type ThemeChoice } from "@/lib/theme";
import {
  VIEWS,
  VIEW_DESCRIPTIONS,
  VIEW_LABELS,
  hrefFor,
  navigate,
  type View,
} from "@/lib/route";
import type { ConnectionState } from "@/types";
import { cn } from "@/lib/utils";

const VIEW_ICONS: Record<View, LucideIcon> = {
  overview: Gauge,
  discovery: Compass,
  product: Target,
  blueprint: Map,
  features: Layers,
  workflows: Workflow,
  data: Database,
  architecture: Network,
  tasks: ListChecks,
  team: Users,
  decisions: Scale,
  changes: GitCompare,
  evidence: ShieldCheck,
  surfaces: MonitorSmartphone,
  apis: Plug,
  settings: SlidersHorizontal,
  "test-plans": ClipboardCheck,
  sync: RefreshCw,
  activity: Activity,
  readiness: ShieldCheck,
};

/**
 * The rail is grouped so nineteen entries do not read as one long list.
 *
 * Every view in VIEWS belongs to exactly one group. Six areas were reachable by
 * address and missing from here, which made them effectively invisible: a page
 * nobody can navigate to is one nobody knows exists. The check below fails the
 * build rather than letting that happen again.
 */
const NAV_GROUPS: { label: string; views: View[] }[] = [
  { label: "Where we are", views: ["overview", "readiness", "activity"] },
  {
    label: "What we are building",
    views: ["discovery", "product", "blueprint", "features", "workflows"],
  },
  {
    label: "How it is built",
    views: ["data", "architecture", "apis", "surfaces", "decisions"],
  },
  {
    label: "How we know it works",
    views: ["evidence", "test-plans", "changes"],
  },
  { label: "Who is doing it", views: ["tasks", "team", "sync", "settings"] },
];

/**
 * A view that is routable and unreachable is a defect, so this is a type error
 * rather than a comment. Adding a view to VIEWS without placing it in a group
 * stops compiling here.
 */
const NAVIGABLE = new Set(NAV_GROUPS.flatMap((g) => g.views));
const UNREACHABLE_VIEWS: Exclude<View, never>[] = VIEWS.filter((v) => !NAVIGABLE.has(v));
if (UNREACHABLE_VIEWS.length > 0) {
  // Thrown at module load, in development and in the packaged bundle alike,
  // because a silent gap here is exactly what hid six areas.
  throw new Error(
    `These views have no place in the navigation, so nobody can reach them: ${UNREACHABLE_VIEWS.join(", ")}.`,
  );
}

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
  degraded: "Not updating",
};

const THEME_ICONS: Record<ThemeChoice, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export interface AppShellProps {
  /** The view currently on screen, so the rail can mark it. */
  view: View;
  /** Project name in plain language. Undefined while it is still being read. */
  projectName?: string | null;
  /** Live, reconnecting or offline. */
  connection: ConnectionState;
  /** One sentence saying what the connection state means right now. */
  connectionExplanation: string;
  onReconnect?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  view,
  projectName,
  connection,
  connectionExplanation,
  onReconnect,
  children,
}: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { choice, setTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[choice];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the narrow-screen navigation once a destination has been chosen.
  useEffect(() => setNavOpen(false), [view]);

  return (
    <SidebarProvider>
    <div className="flex min-h-dvh flex-col bg-substrate text-ink">
      <a
        href="#view-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sd focus:border focus:border-signal focus:bg-panel focus:px-3 focus:py-2 focus:font-chassis focus:text-chassis focus:text-ink"
      >
        Skip to the main content
      </a>

      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-panel-raised px-3">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open the navigation"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <SheetHeader>
              <SheetTitle>
                <span className="flex items-center gap-2">
                  <SuperdevLogo className="size-8" />
                  <span>Superdev</span>
                </span>
              </SheetTitle>
              <SheetDescription>
                Twelve views onto this project. Choose one to close this panel.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Views"
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              <NavList current={view} />
            </nav>
          </SheetContent>
        </Sheet>

        {/* Identity first, then the control that acts on the layout. The
            product's name is what a person looks for to know where they are;
            a collapse toggle is a tool, and a tool reads better after the thing
            it belongs to. */}
        <a
          href={hrefFor("overview")}
          aria-label="Superdev. Go to the overview."
          className="flex min-w-0 items-center gap-2 rounded-sd px-1 py-1 focus-ring"
        >
          <SuperdevLogo />
          <span className="hidden font-chassis text-label text-ink-3 uppercase sm:inline">
            Superdev
          </span>
        </a>

        <SidebarTrigger />

        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-rule" />

        <h1 className="min-w-0 truncate font-prose text-subtitle text-ink">
          {projectName ? (
            projectName
          ) : projectName === null ? (
            "Project name unavailable"
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </h1>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="gap-2 text-ink-3"
            aria-keyshortcuts="Meta+K Control+K"
            // The label hides on a narrow screen, so the name is set here too.
            // It names what the box actually does: it does not search record
            // text, so promising "search the project" would be a lie.
            aria-label="Find a view, or open a record by its identifier"
          >
            <Search />
            <span className="hidden md:inline" aria-hidden="true">
              Search
            </span>
            <kbd
              aria-hidden="true"
              className="hidden rounded-sd-sm border border-rule bg-inset px-1 font-chassis text-[10px] text-ink-3 md:inline"
            >
              Cmd K
            </kbd>
          </Button>

          <button
            type="button"
            onClick={onReconnect}
            title={connectionExplanation}
            aria-label={`Connection: ${CONNECTION_LABELS[connection]}. ${connectionExplanation} Activate to reconnect now.`}
            className="rounded-sd-sm focus-ring"
          >
            <span aria-hidden="true">
              <ConnectionStatus
                state={connection}
                explanation={connectionExplanation}
              />
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Theme: ${THEME_LABELS[choice]}. Change it.`}
              >
                <ThemeIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={choice}
                onValueChange={(value) => setTheme(value as ThemeChoice)}
              >
                {(["light", "dark", "system"] as ThemeChoice[]).map((option) => {
                  const Icon = THEME_ICONS[option];
                  return (
                    <DropdownMenuRadioItem key={option} value={option}>
                      <Icon />
                      {THEME_LABELS[option]}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar label="Views" id="view-navigation">
          <NavList current={view} />
        </Sidebar>

        <main
          id="view-content"
          tabIndex={-1}
          className="min-w-0 flex-1 focus:outline-none"
        >
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
    </SidebarProvider>
  );
}

function SuperdevLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt=""
      aria-hidden="true"
      className={cn(
        "size-7 shrink-0 rounded-sd-sm object-cover",
        className,
      )}
    />
  );
}

/**
 * The standard head of a view: one display title, one sentence saying what the
 * view answers, and a slot for the view's own controls. Every view uses this so
 * the first line of the page reads the same way everywhere.
 */
export function ViewHeader({
  view,
  title,
  description,
  actions,
  children,
}: {
  view?: View;
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const resolvedTitle = title ?? (view ? VIEW_LABELS[view] : "");
  const resolvedDescription =
    description ?? (view ? VIEW_DESCRIPTIONS[view] : null);

  return (
    <div className="flex flex-col gap-3 border-b border-rule bg-panel px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-prose text-display text-ink">{resolvedTitle}</h2>
          {resolvedDescription ? (
            <p className="font-prose text-body text-ink-2 prose-measure">
              {resolvedDescription}
            </p>
          ) : null}
        </div>
        {actions ? (
          // Deliberately not shrink-0: anything wide enough to overflow a phone
          // must be able to shrink and wrap rather than set the page width.
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** The scrolling body of a view, below its header. */
export function ViewBody({
  className,
  width = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /**
   * How wide the page is allowed to run.
   *
   * "prose" is for pages that are mostly written records, where a 1400px panel
   * around a 68ch column leaves a wide empty gutter and the text looks stranded.
   * "default" suits tables and mixed content. "full" is for a page that is one
   * picture, where a reading measure actively hurts.
   */
  width?: "prose" | "default" | "full";
}) {
  const ceiling =
    width === "prose" ? "max-w-[62rem]" : width === "full" ? "max-w-none" : "max-w-[1400px]";
  return (
    <div
      className={cn(
        // Centred with a ceiling. Text is capped at a 68ch reading measure, so
        // on a wide display an uncapped page left the column hard against the
        // sidebar with several hundred pixels of nothing beside it. The page
        // now keeps its own margins and the slack sits on both sides.
        // twMerge is in cn, so a view that needs the full width can pass
        // max-w-none.
        "mx-auto flex w-full flex-col gap-4 px-4 py-4 sm:px-6",
        ceiling,
        className,
      )}
      {...props}
    />
  );
}

function NavList({ current }: { current: View }) {
  return (
    <div className="flex flex-col gap-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          {group.views.map((item) => (
            <SidebarItem
              key={item}
              href={hrefFor(item)}
              icon={VIEW_ICONS[item]}
              label={VIEW_LABELS[item]}
              description={VIEW_DESCRIPTIONS[item]}
              active={item === current}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Which view owns each kind of record identifier.
 *
 * There is no search endpoint in the module contract, so this does not pretend
 * to search record text. What it does do is take an identifier someone has
 * pasted or been given and open the view that owns it, which is the thing
 * people actually arrive here wanting to do.
 */
const RECORD_PREFIX_VIEWS: Record<string, View> = {
  GOAL: "product",
  MS: "product",
  MOD: "product",
  FEAT: "features",
  WF: "workflows",
  TASK: "tasks",
  DEC: "decisions",
  ENT: "data",
  MIG: "data",
  RT: "architecture",
  DIS: "discovery",
  SRC: "discovery",
  Q: "readiness",
  CAP: "readiness",
  SES: "team",
  DEV: "team",
  AGT: "team",
  GBR: "team",
  BR: "workflows",
  MEM: "activity",
  EVT: "activity",
};

/** `FEAT-0002` to the Features view. Null when the text is not an identifier. */
function recordTarget(
  query: string,
): { id: string; view: View; kind: string } | null {
  const id = query.trim().toUpperCase();
  const match = /^([A-Z]+)-([A-Z0-9]+)$/.exec(id);
  if (!match) return null;
  const view = RECORD_PREFIX_VIEWS[match[1]];
  return view ? { id, view, kind: VIEW_LABELS[view] } : null;
}

/**
 * The global search trigger. It covers the twelve views plus jumping straight
 * to a record by its identifier; anything else is searched from inside the view
 * that owns it, which is what the empty state says.
 */
function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const record = recordTarget(query);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search views, or paste a record identifier"
      />
      <CommandList>
        <CommandEmpty>
          Nothing here matches {query ? `"${query}"` : "that"}. This box finds
          views by name and opens a record from its identifier, for example
          FEAT-0002. To search inside the records themselves, open the view that
          owns them: Activity And Memory searches the timeline, and Tasks,
          Features and Product each search their own list.
        </CommandEmpty>

        {record ? (
          <CommandGroup heading="Record">
            <CommandItem
              value={`open record ${record.id}`}
              onSelect={() => {
                navigate(record.view, record.id);
                close();
              }}
            >
              <Search className="text-ink-3" />
              <span>Open {record.id}</span>
              <CommandShortcut className="font-prose normal-case tracking-normal">
                Goes to {record.kind}. If nothing there has that identifier, the
                page will say so.
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Views">
          {VIEWS.map((item) => {
            const Icon = VIEW_ICONS[item];
            return (
              <CommandItem
                key={item}
                value={`${VIEW_LABELS[item]} ${VIEW_DESCRIPTIONS[item]}`}
                onSelect={() => {
                  navigate(item);
                  close();
                }}
              >
                <Icon className="text-ink-3" />
                <span>{VIEW_LABELS[item]}</span>
                <CommandShortcut className="font-prose normal-case tracking-normal">
                  {VIEW_DESCRIPTIONS[item]}
                </CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
