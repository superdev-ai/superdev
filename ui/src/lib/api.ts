/**
 * The typed fetch layer. Every GET route in MODULE_CONTRACT.md plus the single
 * mutation endpoint. Nothing else is called; the browser never submits SQL, a
 * shell command or a path.
 *
 * Every read returns the freshness envelope alongside the data, because the
 * interface has to be able to say how current a number is.
 */

import type {
  ActivityPayload,
  ApiErrorBody,
  ApisPayload,
  ArchitecturePayload,
  ChangesPayload,
  DataPayload,
  DecisionsPayload,
  DiscoveryPayload,
  Envelope,
  EvidencePayload,
  FeatureDetailPayload,
  Health,
  Meta,
  MutationAction,
  MutationResult,
  OverviewPayload,
  ProductPayload,
  ReadinessPayload,
  Result,
  SettingsPayload,
  SurfacesPayload,
  SyncPayload,
  TasksPayload,
  TeamPayload,
  TestPlansPayload,
  WorkflowsPayload,
} from "@/types";

/** Same origin in the packaged plugin; the dev server proxies to the service. */
export const API_BASE = "";

/**
 * A failure a person can act on. `code` is the stable code from the service,
 * `message` already says what happened and what to do next.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when the service could not be reached at all. */
  get isOffline() {
    return this.status === 0;
  }
}

const OFFLINE_MESSAGE =
  "The Superdev service is not answering on this machine. Start it with " +
  "`superdev start --apply` in the project directory, then choose Retry.";

function fallbackMeta(): Meta {
  return {
    revision: 0,
    lastEventSequence: 0,
    generatedAt: new Date().toISOString(),
    stale: true,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : null),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("E_SERVICE_UNREACHABLE", OFFLINE_MESSAGE, 0);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(
        "E_BAD_RESPONSE",
        "The service replied with something this page could not read. Check " +
          "the service log, then choose Retry.",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const error = (body ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      error.code ?? "E_REQUEST_FAILED",
      error.message ??
        `The request to ${path} failed with status ${response.status}. Check ` +
          "the service log, then choose Retry.",
      response.status,
      error.details,
    );
  }

  const envelope = body as Partial<Envelope<T>> | null;
  if (!envelope || envelope.data === undefined) {
    throw new ApiError(
      "E_BAD_RESPONSE",
      `The reply from ${path} did not contain any data. The service may be ` +
        "mid-upgrade. Choose Retry, and check the service log if it repeats.",
      response.status,
    );
  }

  return {
    data: envelope.data as T,
    meta: { ...fallbackMeta(), ...envelope.meta },
  };
}

/**
 * Health is the one route without the envelope. It answers "is the service
 * there, and is it pointed at this project".
 */
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/health`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("E_SERVICE_UNREACHABLE", OFFLINE_MESSAGE, 0);
  }
  if (!response.ok) {
    throw new ApiError(
      "E_REQUEST_FAILED",
      "The service answered but reported that it is not healthy. Check the " +
        "service log, then choose Retry.",
      response.status,
    );
  }
  return (await response.json()) as Health;
}

const get =
  <T>(path: string) =>
  (signal?: AbortSignal) =>
    request<T>(path, { signal });

export const getOverview = get<OverviewPayload>("/api/overview");
export const getDiscovery = get<DiscoveryPayload>("/api/discovery");
export const getProduct = get<ProductPayload>("/api/product");
export const getWorkflows = get<WorkflowsPayload>("/api/workflows");
export const getData = get<DataPayload>("/api/data");
export const getArchitecture = get<ArchitecturePayload>("/api/architecture");
export const getTasks = get<TasksPayload>("/api/tasks");
export const getTeam = get<TeamPayload>("/api/team");
export const getDecisions = get<DecisionsPayload>("/api/decisions");
export const getReadiness = get<ReadinessPayload>("/api/readiness");
export const getSurfaces = get<SurfacesPayload>("/api/surfaces");
export const getApis = get<ApisPayload>("/api/apis");
export const getChanges = get<ChangesPayload>("/api/changes");
export const getEvidence = get<EvidencePayload>("/api/evidence");
export const getSettings = get<SettingsPayload>("/api/settings");
export const getTestPlans = get<TestPlansPayload>("/api/test-plans");
export const getSync = get<SyncPayload>("/api/sync");

export function getFeature(
  id: string,
  signal?: AbortSignal,
): Promise<Result<FeatureDetailPayload>> {
  return request<FeatureDetailPayload>(
    `/api/features/${encodeURIComponent(id)}`,
    { signal },
  );
}

export interface ActivityQuery {
  /** Return events with a sequence below this value. */
  before?: number;
  limit?: number;
  /** Free-text search across event summaries and project memory. */
  search?: string;
}

export function getActivity(
  query: ActivityQuery = {},
  signal?: AbortSignal,
): Promise<Result<ActivityPayload>> {
  const search = new URLSearchParams();
  if (query.before !== undefined) search.set("before", String(query.before));
  if (query.limit !== undefined) search.set("limit", String(query.limit));
  if (query.search) search.set("search", query.search);
  const qs = search.toString();
  return request<ActivityPayload>(`/api/activity${qs ? `?${qs}` : ""}`, {
    signal,
  });
}

/**
 * The one write path. `action` must be one of the accepted actions; the service
 * refuses anything else.
 */
export function postMutation<T = unknown>(
  action: MutationAction,
  payload: unknown,
  signal?: AbortSignal,
): Promise<MutationResult<T>> {
  return request<T>("/api/mutations", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
    signal,
  });
}

/** Route table, so a caller can refetch a view by name after a change event. */
export const readers = {
  overview: getOverview,
  discovery: getDiscovery,
  product: getProduct,
  workflows: getWorkflows,
  surfaces: getSurfaces,
  apis: getApis,
  changes: getChanges,
  evidence: getEvidence,
  settings: getSettings,
  "test-plans": getTestPlans,
  sync: getSync,
  data: getData,
  architecture: getArchitecture,
  tasks: getTasks,
  team: getTeam,
  decisions: getDecisions,
  readiness: getReadiness,
} as const;
