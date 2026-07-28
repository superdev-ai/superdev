/**
 * A collapsible navigation rail.
 *
 * Shaped after the shadcn sidebar, but written against this project's tokens
 * rather than installed. The generator wants a components.json and rewrites the
 * Tailwind theme and index.css to its own palette, which would fight the
 * OKLCH token system in DESIGN_DIRECTION.md. The behaviour is what was wanted,
 * not the palette, so only the behaviour was taken.
 *
 * Collapsed, the rail keeps its icons and every item grows a tooltip, so
 * narrowing the nav never costs you the ability to read it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "superdev.sidebar";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const value = useContext(SidebarContext);
  if (!value) throw new Error("useSidebar must be used inside SidebarProvider.");
  return value;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  });

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "collapsed" : "expanded");
    } catch {
      // A browser with storage denied still gets a working sidebar for this
      // session. Losing the preference is not worth failing the render for.
    }
  }, []);

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  // The shortcut people already expect from this shape of interface.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function Sidebar({
  className,
  children,
  label,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
  id?: string;
}) {
  const { collapsed } = useSidebar();
  return (
    <nav
      id={id}
      aria-label={label}
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "hidden shrink-0 border-r border-rule bg-panel-raised p-2 lg:block",
        // Width is the only thing that animates, and it is skipped entirely
        // under reduced motion by the global rule in index.css.
        "transition-[width] duration-[160ms] ease-sd",
        collapsed ? "w-14" : "w-56",
        className,
      )}
    >
      <div className="sticky top-14">{children}</div>
    </nav>
  );
}

/** A group heading that disappears when there is no room to read it. */
export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  if (collapsed) {
    // A rule stands in for the words, so the grouping survives the collapse.
    return <span aria-hidden="true" className="mx-2 my-1 h-px bg-rule" />;
  }
  return (
    <span className="px-2 py-1 font-chassis text-label text-ink-3 uppercase">
      {children}
    </span>
  );
}

/**
 * One navigation item. Collapsed it shows the icon alone, keeps its accessible
 * name, and carries a title so the pointer can still identify it.
 */
export function SidebarItem({
  href,
  icon: Icon,
  label,
  description,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  description?: string;
  active: boolean;
}) {
  const { collapsed } = useSidebar();
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : description}
      className={cn(
        "flex items-center gap-2 rounded-sd py-1.5 font-chassis text-chassis transition-colors duration-[120ms] ease-sd focus-ring",
        collapsed ? "justify-center px-0" : "px-2",
        active
          ? "bg-signal-wash text-ink shadow-[inset_2px_0_0_var(--sd-signal)]"
          : "text-ink-2 hover:bg-inset hover:text-ink",
      )}
    >
      <Icon
        aria-hidden={true}
        className={cn("size-4 shrink-0", active ? "text-signal" : "text-ink-3")}
      />
      {/* Collapsed, the label stays in the accessibility tree and leaves the
          layout, so a screen reader still reads a named link. */}
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </a>
  );
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls="view-navigation"
      title={`${collapsed ? "Expand" : "Collapse"} the navigation. Command B.`}
      className={cn(
        "hidden size-8 shrink-0 items-center justify-center rounded-sd text-ink-3 transition-colors duration-[120ms] ease-sd hover:bg-inset hover:text-ink focus-ring lg:inline-flex",
        className,
      )}
    >
      <span className="sr-only">
        {collapsed ? "Expand the navigation" : "Collapse the navigation"}
      </span>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <line x1="6" y1="2.5" x2="6" y2="13.5" />
      </svg>
    </button>
  );
}
