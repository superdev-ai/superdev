/**
 * Hash routing: `#/view` or `#/view/record`.
 *
 * There is no router library. The hash carries the view and, when one is open,
 * the selected record, so any state a person is looking at can be copied out of
 * the address bar and reopened by someone else.
 */

import { useCallback, useEffect, useState } from "react";

export const VIEWS = [
  "overview",
  "discovery",
  "product",
  "blueprint",
  "features",
  "workflows",
  "data",
  "architecture",
  "tasks",
  "team",
  "decisions",
  "changes",
  "evidence",
  "activity",
  "readiness",
  "surfaces",
  "apis",
  "settings",
  "test-plans",
  "sync",
] as const;

export type View = (typeof VIEWS)[number];

export const DEFAULT_VIEW: View = "overview";

/** Plain-language name for each view. Never show the slug to a person. */
export const VIEW_LABELS: Record<View, string> = {
  overview: "Overview",
  discovery: "Discovery",
  product: "Product",
  blueprint: "Blueprint",
  features: "Features",
  workflows: "Workflows",
  data: "Data",
  architecture: "Architecture",
  tasks: "Tasks",
  team: "Team And Agents",
  decisions: "Decisions",
  changes: "Changes",
  evidence: "Evidence",
  surfaces: "UI Surfaces",
  apis: "APIs",
  settings: "Settings",
  "test-plans": "Test Plans",
  sync: "Sync",
  activity: "Activity And Memory",
  readiness: "Readiness",
};

/** One line saying what the view answers, used in navigation and search. */
export const VIEW_DESCRIPTIONS: Record<View, string> = {
  overview: "What is being built, what works, and what should happen next",
  discovery: "Sources, questions, assumptions and risks behind the product",
  product: "Goals, milestones, modules and features with counted progress",
  blueprint: "The whole product as one map, drawn from what connects to what",
  features: "Every feature and the full contract hanging off it",
  workflows: "Ordered steps, actors, branches and live execution state",
  data: "Entities, fields, relationships and migrations",
  architecture: "Runtime pieces, module dependencies and integrations",
  tasks: "The work itself: claim, block, complete, and its evidence",
  team: "Developers, agents, branches, sessions and presence",
  decisions: "What was decided, what it binds, and what would reopen it",
  changes: "What moved in accepted scope, why, and what it touched",
  evidence: "What proves the product works, and what can be checked again",
  surfaces: "The screens a person touches and the actions on each",
  apis: "Operations, what they change, and the services grouping them",
  settings: "What this installation is, where it stores things, what it holds",
  "test-plans": "How each feature is meant to be verified, and what runs",
  sync: "What is shared with another copy, what never leaves, and what disagrees",
  activity: "The change timeline and searchable project memory",
  readiness: "Capability areas, module completeness and release readiness",
};

export interface Route {
  view: View;
  /** The selected record id, when the hash carries one. */
  record: string | null;
}

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

export function parseHash(hash: string): Route {
  const trimmed = hash.replace(/^#\/?/, "");
  const [rawView, ...rest] = trimmed.split("/").filter(Boolean);
  const view = rawView && isView(rawView) ? rawView : DEFAULT_VIEW;
  const record = rest.length > 0 ? decodeURIComponent(rest.join("/")) : null;
  return { view, record };
}

export function hrefFor(view: View, record?: string | null): string {
  return record ? `#/${view}/${encodeURIComponent(record)}` : `#/${view}`;
}

export function navigate(view: View, record?: string | null) {
  const next = hrefFor(view, record);
  if (window.location.hash !== next) window.location.hash = next;
}

/** Replace rather than push, for selections that should not stack in history. */
export function replaceRoute(view: View, record?: string | null) {
  const next = hrefFor(view, record);
  if (window.location.hash === next) return;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function currentRoute(): Route {
  return parseHash(window.location.hash);
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => currentRoute());

  useEffect(() => {
    // An empty hash, or one naming a view that does not exist, both render the
    // overview. Rewrite the address bar to say so, otherwise the link someone
    // copies promises a page they were never shown.
    const normalize = () => {
      const parsed = parseHash(window.location.hash);
      const expected = hrefFor(parsed.view, parsed.record);
      if (window.location.hash !== expected) {
        window.history.replaceState(null, "", expected);
      }
      setRoute(parsed);
    };

    window.addEventListener("hashchange", normalize);
    normalize();
    return () => window.removeEventListener("hashchange", normalize);
  }, []);

  const go = useCallback((view: View, record?: string | null) => {
    navigate(view, record);
  }, []);

  return { route, go, replace: replaceRoute };
}
