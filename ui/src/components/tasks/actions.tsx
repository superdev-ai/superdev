/**
 * Every write the tasks surface can make, and every way one can be refused.
 *
 * Writes go through postMutation with exactly the allowlisted actions. A refusal
 * is never swallowed: the service already answers with a sentence saying what
 * happened, and this module adds the one control that resolves it, so a person
 * is never left holding an error code.
 */

import {
  Ban,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Hand,
  Link2,
  ListPlus,
  Pencil,
  RefreshCw,
  RotateCcw,
  ScanEye,
  Send,
  ShieldQuestion,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import type * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, postMutation } from "@/lib/api";
import { countPhrase, titleCase } from "@/lib/format";
import { statusLabel } from "@/components/shell/status";
import type { MutationAction } from "@/types";
import { cn } from "@/lib/utils";

import {
  CONTRACT_RELATIONSHIPS,
  CONTRACT_TARGET_LABELS,
  CONTRACT_TARGET_TYPES,
  TASK_PRIORITIES,
  contractTargetLabel,
  isOpenStatus,
  relationshipLabel,
  type Option,
  type TaskIndex,
  type TaskRow,
} from "@/components/tasks/model";

/* ---------------------------------------------------------------------------
   The lifecycle, as the service enforces it

   Mirrored here so a control that cannot work is not offered in the first
   place. The service remains the authority: anything this table gets wrong
   comes back as a refusal with its own explanation.
   --------------------------------------------------------------------------- */

const ALLOWED_MOVES: Record<string, string[]> = {
  draft: ["ready", "in_progress", "cancelled"],
  ready: ["draft", "in_progress", "blocked", "paused", "cancelled"],
  in_progress: [
    "in_review",
    "verifying",
    "blocked",
    "paused",
    "complete",
    "cancelled",
  ],
  in_review: ["in_progress", "verifying", "blocked", "complete", "cancelled"],
  verifying: ["in_progress", "in_review", "blocked", "complete", "cancelled"],
  blocked: ["ready", "in_progress", "paused", "cancelled"],
  paused: ["ready", "in_progress", "blocked", "cancelled"],
  complete: ["in_progress"],
  cancelled: ["ready", "draft"],
  superseded: ["ready"],
};

/** The narrower gate the service puts on plain repositionings within open work. */
const REPOSITION_FROM: Record<string, string[]> = {
  draft: ["ready"],
  ready: ["draft", "paused", "cancelled"],
  paused: ["ready", "in_progress"],
};

export function canMove(status: string, to: string): boolean {
  if (!(ALLOWED_MOVES[status] ?? []).includes(to)) return false;
  if (status === "blocked") return true;
  const gate = REPOSITION_FROM[to];
  return gate ? gate.includes(status) : true;
}

/* ---------------------------------------------------------------------------
   The action catalogue
   --------------------------------------------------------------------------- */

export type TaskActionId =
  | "claim"
  | "release"
  | "start"
  | "review"
  | "verify"
  | "pause"
  | "block"
  | "complete"
  | "reopen"
  | "cancel"
  | "subtask"
  | "link"
  | "edit";

export interface TaskActionSpec {
  id: TaskActionId;
  label: string;
  /** Single key, pressed with no modifier while a task is selected. */
  shortcut: string;
  icon: LucideIcon;
  /** What it does, for the shortcut sheet and the button title. */
  hint: string;
  /** Shown first, in the row of buttons. */
  primary?: boolean;
}

export const TASK_ACTIONS: TaskActionSpec[] = [
  {
    id: "claim",
    label: "Claim",
    shortcut: "c",
    icon: Hand,
    hint: "Take this task, optionally naming the developer, agent and branch.",
    primary: true,
  },
  {
    id: "release",
    label: "Release",
    shortcut: "r",
    icon: UserMinus,
    hint: "Hand the task back. Its status does not change, only the claim ends.",
    primary: true,
  },
  {
    id: "start",
    label: "Start",
    shortcut: "s",
    icon: CirclePlay,
    hint: "Move the task to In Progress.",
    primary: true,
  },
  {
    id: "review",
    label: "Send for review",
    shortcut: "v",
    icon: Send,
    hint: "Move the task to In Review.",
  },
  {
    id: "verify",
    label: "Verify",
    shortcut: "y",
    icon: ScanEye,
    hint: "Move the task to Verifying while its evidence is checked.",
  },
  {
    id: "pause",
    label: "Pause",
    shortcut: "p",
    icon: CirclePause,
    hint: "Park the task without cancelling it.",
  },
  {
    id: "block",
    label: "Block",
    shortcut: "b",
    icon: Ban,
    hint: "Record that the task cannot proceed, and why.",
    primary: true,
  },
  {
    id: "complete",
    label: "Complete",
    shortcut: "d",
    icon: CircleCheck,
    hint: "Finish the task. The service refuses if subtasks or evidence are outstanding.",
    primary: true,
  },
  {
    id: "reopen",
    label: "Reopen",
    shortcut: "o",
    icon: RotateCcw,
    hint: "Put a finished or cancelled task back into open work, with a reason.",
    primary: true,
  },
  {
    id: "cancel",
    label: "Cancel",
    shortcut: "x",
    icon: Ban,
    hint: "Stop the task for good, with a reason the next person can read.",
  },
  {
    id: "subtask",
    label: "Add subtask",
    shortcut: "t",
    icon: ListPlus,
    hint: "Create a smaller piece of work under this task.",
  },
  {
    id: "link",
    label: "Link a contract",
    shortcut: "l",
    icon: Link2,
    hint: "Say what this task implements: a workflow step, action, operation, entity, migration, integration, job, webhook, requirement, document or decision.",
  },
  {
    id: "edit",
    label: "Edit",
    shortcut: "e",
    icon: Pencil,
    hint: "Change the wording, priority, criteria and dates.",
  },
];

const ACTION_BY_ID = new Map(TASK_ACTIONS.map((action) => [action.id, action]));

export function actionSpec(id: TaskActionId): TaskActionSpec {
  // Every id in the union has an entry, so this is total.
  return ACTION_BY_ID.get(id) as TaskActionSpec;
}

/** Whether an action can be attempted on this task at all. */
export function isActionAvailable(id: TaskActionId, task: TaskRow): boolean {
  const status = task.status;
  const claimed = Boolean(task.assignment);
  switch (id) {
    case "claim":
      return isOpenStatus(status) && !claimed;
    case "release":
      return claimed;
    case "start":
      return canMove(status, "in_progress");
    case "review":
      return canMove(status, "in_review");
    case "verify":
      return canMove(status, "verifying");
    case "pause":
      return canMove(status, "paused");
    case "block":
      return canMove(status, "blocked");
    case "complete":
      return canMove(status, "complete");
    case "reopen":
      return !isOpenStatus(status);
    case "cancel":
      return canMove(status, "cancelled");
    case "subtask":
    case "link":
    case "edit":
      return true;
    default:
      return false;
  }
}

/** Why an action is not offered right now, as a sentence. */
export function unavailableReason(id: TaskActionId, task: TaskRow): string {
  const where = `${task.id} is ${statusLabel(task.status)}`;
  switch (id) {
    case "claim":
      return task.assignment
        ? `${task.id} is already claimed. Release it first if it needs a different owner.`
        : `${where}, which is finished work rather than open work, so there is nothing to claim. Reopen it first.`;
    case "release":
      return `${task.id} is not claimed by anyone, so there is nothing to release.`;
    case "reopen":
      return `${where} and is already open. Reopening applies to completed or cancelled work.`;
    default:
      return `${where}, and cannot be ${actionSpec(id).label.toLowerCase()} from there. Allowed moves from here: ${
        (ALLOWED_MOVES[task.status] ?? []).map(statusLabel).join(", ") ||
        "none, this status is terminal"
      }.`;
  }
}

/* ---------------------------------------------------------------------------
   Running one mutation
   --------------------------------------------------------------------------- */

export interface Refusal {
  /** Stable code from the service, for example E_OPEN_SUBTASKS. */
  code: string;
  /** The service's own sentence, which already says what to do next. */
  message: string;
  /** What was being attempted, in plain language. */
  attempted: string;
  taskId: string | null;
  details: unknown;
}

export interface TaskMutation {
  run: (
    action: MutationAction,
    payload: Record<string, unknown>,
    attempted: string,
    taskId?: string | null,
  ) => Promise<boolean>;
  /** The description of the write in flight, or null. */
  pending: string | null;
  refusal: Refusal | null;
  /** The last successful write, so the panel can confirm it happened. */
  confirmed: string | null;
  clear: () => void;
}

export function useTaskMutation(onDone: () => void): TaskMutation {
  const [pending, setPending] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const clear = useCallback(() => {
    setRefusal(null);
    setConfirmed(null);
  }, []);

  const run = useCallback(
    async (
      action: MutationAction,
      payload: Record<string, unknown>,
      attempted: string,
      taskId: string | null = null,
    ) => {
      setPending(attempted);
      setRefusal(null);
      setConfirmed(null);
      try {
        await postMutation(action, payload);
        setConfirmed(attempted);
        onDone();
        return true;
      } catch (error) {
        const api = error instanceof ApiError ? error : null;
        setRefusal({
          code: api?.code ?? "E_REQUEST_FAILED",
          message:
            api?.message ??
            (error instanceof Error
              ? error.message
              : "The service did not say what went wrong. Check the service log, then try again."),
          attempted,
          taskId,
          details: api?.details ?? null,
        });
        return false;
      } finally {
        setPending(null);
      }
    },
    [onDone],
  );

  return { run, pending, refusal, confirmed, clear };
}

/* ---------------------------------------------------------------------------
   Showing a refusal
   --------------------------------------------------------------------------- */

interface RefusalNoticeProps {
  refusal: Refusal;
  task: TaskRow | null;
  index: TaskIndex;
  onOpenTask: (id: string) => void;
  onAction: (id: TaskActionId) => void;
  onRefresh: () => void;
  onDismiss: () => void;
}

/**
 * The service's message is always shown, because it is written to be acted on.
 * What is added here is the control that resolves this particular refusal, and
 * the records it names turned into things a person can open.
 */
export function RefusalNotice({
  refusal,
  task,
  index,
  onOpenTask,
  onAction,
  onRefresh,
  onDismiss,
}: RefusalNoticeProps) {
  const openSubtasks =
    refusal.code === "E_OPEN_SUBTASKS" && task
      ? (index.childrenOf.get(task.id) ?? []).filter((child) =>
          isOpenStatus(child.status),
        )
      : [];

  const guidance = REFUSAL_GUIDANCE[refusal.code];

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-sd-lg border border-state-blocked/45 bg-state-blocked-wash p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-chassis text-label text-state-blocked uppercase">
            Refused: {refusal.attempted}
          </span>
          <p className="font-prose text-body text-ink prose-measure">
            {refusal.message}
          </p>
          {guidance ? (
            <p className="font-prose text-small text-ink-2 prose-measure">
              {guidance}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="shrink-0"
        >
          Dismiss
        </Button>
      </div>

      {openSubtasks.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-sd border border-rule bg-panel p-2">
          <span className="font-chassis text-label text-ink-3 uppercase">
            {countPhrase(openSubtasks.length, "open subtask")} to finish first
          </span>
          <ul className="flex flex-col gap-1">
            {openSubtasks.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(child.id)}
                  className="flex w-full items-center gap-2 rounded-sd px-1.5 py-1 text-left transition-colors duration-[120ms] ease-sd focus-ring hover:bg-inset"
                >
                  <span className="min-w-0 flex-1 truncate font-prose text-small text-ink">
                    {child.name}
                  </span>
                  <span className="shrink-0 font-chassis text-chassis-sm text-ink-3">
                    {child.id}
                  </span>
                  <span className="shrink-0 font-chassis text-chassis-sm text-ink-2">
                    {statusLabel(child.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {refusal.code === "E_TASK_WITHOUT_CONTRACT" ? (
          <Button size="sm" onClick={() => onAction("link")}>
            <Link2 />
            Link a contract now
          </Button>
        ) : null}
        {refusal.code === "E_ENABLING_WITHOUT_TARGET" ? (
          <Button size="sm" onClick={() => onAction("edit")}>
            <Pencil />
            Name the feature it unblocks
          </Button>
        ) : null}
        {refusal.code === "E_ALREADY_CLAIMED" ? (
          <Button size="sm" onClick={() => onAction("release")}>
            <UserMinus />
            Release the current claim
          </Button>
        ) : null}
        {refusal.code === "E_NOT_CLAIMED" ? (
          <Button size="sm" onClick={() => onAction("claim")}>
            <Hand />
            Claim it first
          </Button>
        ) : null}
        {refusal.code === "E_VERSION_CONFLICT" ? (
          <Button size="sm" onClick={onRefresh}>
            <RefreshCw />
            Reload this task
          </Button>
        ) : null}
        <span className="font-chassis text-chassis-sm text-ink-3">
          Reported by the service as {refusal.code}.
        </span>
      </div>
    </div>
  );
}

/** One extra sentence per code, where the service's message benefits from it. */
const REFUSAL_GUIDANCE: Record<string, string> = {
  E_OPEN_SUBTASKS:
    "This task has open subtasks. A parent cannot finish over unfinished children, so close the ones listed below first.",
  E_TASK_WITHOUT_CONTRACT:
    "A task cannot leave draft until it says what it implements. Link it to one part of the product contract, or mark it as enabling work and name the feature it unblocks.",
  E_EVIDENCE_MISSING:
    "Evidence is recorded by whatever actually ran the check, not typed in here. Run the verification the task asks for, then complete it again.",
  E_EVIDENCE_FAILING:
    "The evidence on record says the work does not pass. Fix the work, or record why the old evidence no longer applies.",
  E_ACCEPTANCE_UNMET:
    "This task verifies acceptance criteria on its feature that are still unmet. Open the feature to see which ones.",
  E_VERSION_CONFLICT:
    "Someone else changed this task while this panel was open. Reload it and make the change again on the current version.",
  E_SERVICE_UNREACHABLE:
    "Nothing was written, because nothing answered. Start the service, then try again.",
};

/* ---------------------------------------------------------------------------
   Small form parts

   These are local to the task dialogs rather than shared primitives, because a
   labelled field is the only thing missing from the component set here.
   --------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-chassis text-label text-ink-3 uppercase"
      >
        {label}
        {required ? (
          <span className="ml-1 text-state-blocked">(required)</span>
        ) : null}
      </label>
      {children(id)}
      {hint ? (
        <span className="font-prose text-small text-ink-3 prose-measure">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose one",
  emptyLabel,
  unit = "task",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** Offered when nothing is chosen, e.g. "Anyone". Omit to require a choice. */
  emptyLabel?: string;
  unit?: string;
}) {
  if (options.length === 0) {
    return (
      <p className="rounded-sd border border-rule bg-inset px-2.5 py-2 font-prose text-small text-ink-3 prose-measure">
        There is nothing to choose from yet. This list fills in as the project
        records them.
      </p>
    );
  }
  return (
    <Combobox
      id={id}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.count > 0 ? countPhrase(option.count, unit) : null,
      }))}
    />
  );
}

const linesToList = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const listToLines = (value: string[] | null | undefined) =>
  (value ?? []).join("\n");

/* ---------------------------------------------------------------------------
   Create, edit and subtask
   --------------------------------------------------------------------------- */

export type FormMode = "create" | "edit" | "subtask";

const FORM_TITLES: Record<FormMode, string> = {
  create: "Create a task",
  edit: "Edit this task",
  subtask: "Add a subtask",
};

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FormMode;
  /** The task being edited, or the parent when adding a subtask. */
  task: TaskRow | null;
  index: TaskIndex;
  mutation: TaskMutation;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  mode,
  task,
  index,
  mutation,
}: TaskFormDialogProps) {
  const editing = mode === "edit" ? task : null;

  const [name, setName] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [whyNeeded, setWhyNeeded] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [estimate, setEstimate] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [criteria, setCriteria] = useState("");
  const [verification, setVerification] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [enabledFeatureId, setEnabledFeatureId] = useState("");
  const [enablingRationale, setEnablingRationale] = useState("");

  // Reopening the dialog always shows the record as it currently stands, never
  // whatever was half typed the last time it was open.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setFeatureId(editing?.feature_id ?? task?.feature_id ?? "");
    setWhyNeeded(editing?.why_needed ?? "");
    setExpectedOutcome(editing?.expected_outcome ?? "");
    setDescription(editing?.description ?? "");
    setPriority(editing?.priority ?? "");
    setCategory(
      mode === "edit"
        ? (editing?.category_id ?? "")
        : (task?.categoryName ?? ""),
    );
    setEstimate(editing?.estimate ?? "");
    setDueAt((editing?.due_at ?? "").slice(0, 10));
    setCriteria(listToLines(editing?.completion_criteria_json));
    setVerification(listToLines(editing?.verification_requirements_json));
    setEnabling(Boolean(editing?.enabling));
    setEnabledFeatureId(editing?.enabled_feature_id ?? "");
    setEnablingRationale(editing?.enabling_rationale ?? "");
  }, [open, mode, editing, task]);

  const featureOptions = index.options.feature;
  // A retired category is off the pickable list, which is the whole point of
  // retiring one rather than deleting it. The exception is the value this task
  // already carries: dropping it from the list would silently clear the
  // category the moment somebody opened the task to edit something else.
  const categoryOptions: Option[] = [...index.categoryById.values()]
    .filter((entry) => {
      const value = mode === "edit" ? entry.id : entry.name;
      return Boolean(entry.active) || value === category;
    })
    .map((entry) => ({
      value: mode === "edit" ? entry.id : entry.name,
      label: entry.active ? entry.name : `${entry.name} (retired)`,
      count:
        index.options.category.find((option) => option.value === entry.id)
          ?.count ?? 0,
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const shared: Record<string, unknown> = {
      name: trimmed,
      completionCriteria: linesToList(criteria),
      verificationRequirements: linesToList(verification),
      enabling,
    };
    const put = (key: string, value: string) => {
      if (value.trim()) shared[key] = value.trim();
    };
    put("whyNeeded", whyNeeded);
    put("expectedOutcome", expectedOutcome);
    put("description", description);
    put("priority", priority);
    put("estimate", estimate);
    put("dueAt", dueAt);
    if (enabling) {
      put("enabledFeatureId", enabledFeatureId);
      put("enablingRationale", enablingRationale);
    }

    let ok = false;
    if (mode === "create") {
      if (!featureId) return;
      if (category.trim()) shared.category = category.trim();
      ok = await mutation.run(
        "task.create",
        { ...shared, featureId },
        `Create the task "${trimmed}"`,
      );
    } else if (mode === "subtask") {
      if (!task) return;
      if (category.trim()) shared.category = category.trim();
      ok = await mutation.run(
        "task.addSubtask",
        { ...shared, parentTaskId: task.id },
        `Add the subtask "${trimmed}" under ${task.id}`,
        task.id,
      );
    } else if (editing) {
      if (category.trim()) shared.categoryId = category.trim();
      ok = await mutation.run(
        "task.update",
        {
          ...shared,
          taskId: editing.id,
          expectedVersion: editing.version,
        },
        `Save the changes to ${editing.id}`,
        editing.id,
      );
    }
    if (ok) onOpenChange(false);
  };

  const busy = mutation.pending !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{FORM_TITLES[mode]}</DialogTitle>
          <DialogDescription>
            {mode === "subtask" && task
              ? `The subtask belongs to the same feature as ${task.name}. Say what finishing it will produce.`
              : mode === "edit"
                ? "Leaving a box empty keeps the value already stored. Status moves through the lifecycle controls, not through this form."
                : "A task belongs to exactly one feature and states the outcome it produces. It starts in Draft, and cannot leave Draft until it says what it implements."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          {/* Only the fields scroll. The footer stays put, because a Create
              button you have to go looking for is a button people miss. */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <Field
            label="Name"
            required
            hint="State the outcome, not the activity. For example: Provider routing answers a request end to end."
          >
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={200}
                autoFocus
              />
            )}
          </Field>

          {mode === "create" ? (
            <Field
              label="Feature"
              required
              hint="Work always hangs off one feature, so the product can say what the work was for."
            >
              {(id) => (
                <OptionSelect
                  id={id}
                  value={featureId}
                  onChange={setFeatureId}
                  options={featureOptions}
                  placeholder="Choose the feature this work belongs to"
                />
              )}
            </Field>
          ) : null}

          <Field
            label="Why it exists"
            hint="The reason this work is needed at all, in plain language."
          >
            {(id) => (
              <Textarea
                id={id}
                value={whyNeeded}
                onChange={(event) => setWhyNeeded(event.target.value)}
                rows={2}
              />
            )}
          </Field>

          <Field
            label="Expected outcome"
            hint="What will be observably true once this is done."
          >
            {(id) => (
              <Textarea
                id={id}
                value={expectedOutcome}
                onChange={(event) => setExpectedOutcome(event.target.value)}
                rows={2}
              />
            )}
          </Field>

          <Field label="Description">
            {(id) => (
              <Textarea
                id={id}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Priority">
              {(id) => (
                <OptionSelect
                  id={id}
                  value={priority}
                  onChange={setPriority}
                  emptyLabel="No priority set"
                  options={TASK_PRIORITIES.map((value) => ({
                    value,
                    label: titleCase(value),
                    count: 0,
                  }))}
                />
              )}
            </Field>
            <Field label="Category">
              {(id) => (
                <OptionSelect
                  id={id}
                  value={category}
                  onChange={setCategory}
                  emptyLabel="No category"
                  options={categoryOptions}
                />
              )}
            </Field>
            <Field label="Estimate" hint="Free text, for example: half a day.">
              {(id) => (
                <Input
                  id={id}
                  value={estimate}
                  onChange={(event) => setEstimate(event.target.value)}
                  maxLength={64}
                />
              )}
            </Field>
            <Field label="Due date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              )}
            </Field>
          </div>

          <Field
            label="Completion criteria"
            hint="One per line. These are what someone checks to agree the task is done."
          >
            {(id) => (
              <Textarea
                id={id}
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                rows={3}
              />
            )}
          </Field>

          <Field
            label="Verification requirements"
            hint="One per line. The service refuses to complete a task with requirements but no passing evidence."
          >
            {(id) => (
              <Textarea
                id={id}
                value={verification}
                onChange={(event) => setVerification(event.target.value)}
                rows={3}
              />
            )}
          </Field>

          <div className="flex flex-col gap-2 rounded-sd border border-rule bg-inset p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={enabling}
                onChange={(event) => setEnabling(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--sd-signal)] focus-ring"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-chassis text-chassis text-ink">
                  This is enabling work
                </span>
                <span className="font-prose text-small text-ink-3 prose-measure">
                  Enabling work implements nothing directly: it unblocks a
                  feature. It has to name that feature and say why.
                </span>
              </span>
            </label>
            {enabling ? (
              <div className="flex flex-col gap-3 pl-6">
                <Field label="Feature it unblocks" required>
                  {(id) => (
                    <OptionSelect
                      id={id}
                      value={enabledFeatureId}
                      onChange={setEnabledFeatureId}
                      options={featureOptions}
                      placeholder="Choose the blocked feature"
                    />
                  )}
                </Field>
                <Field label="Why that feature is blocked without it" required>
                  {(id) => (
                    <Textarea
                      id={id}
                      value={enablingRationale}
                      onChange={(event) =>
                        setEnablingRationale(event.target.value)
                      }
                      rows={2}
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </div>

          {mutation.refusal ? (
            <p
              role="alert"
              className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash p-2 font-prose text-small text-ink prose-measure"
            >
              {mutation.refusal.message}
            </p>
          ) : null}

          </div>

          <DialogFooter className="mt-3 shrink-0 border-t border-rule pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving" : FORM_TITLES[mode]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
   Reason dialog: block, cancel, reopen and release
   --------------------------------------------------------------------------- */

export type ReasonKind = "block" | "cancel" | "reopen" | "release" | "complete";

const REASON_COPY: Record<
  ReasonKind,
  { title: string; description: string; label: string; required: boolean; submit: string }
> = {
  block: {
    title: "Block this task",
    description:
      "A blocked task carries the reason it stopped, so the next person can unblock it without asking.",
    label: "What is blocking it",
    required: true,
    submit: "Block it",
  },
  cancel: {
    title: "Cancel this task",
    description:
      "Cancelling is permanent for this record. The reason stops someone deriving the same work again by accident.",
    label: "Why it is being cancelled",
    required: true,
    submit: "Cancel it",
  },
  reopen: {
    title: "Reopen this task",
    description:
      "The record already said this was finished, so reopening it is a recorded decision rather than a quiet edit.",
    label: "Why it is being reopened",
    required: true,
    submit: "Reopen it",
  },
  release: {
    title: "Release this claim",
    description:
      "The task keeps its status. Only the claim ends, so someone else can pick it up.",
    label: "Note for whoever picks it up",
    required: false,
    submit: "Release it",
  },
  complete: {
    title: "Complete this task",
    description:
      "The service checks the subtasks, the evidence and the acceptance criteria before it agrees this is done.",
    label: "Closing note",
    required: false,
    submit: "Complete it",
  },
};

export function ReasonDialog({
  open,
  onOpenChange,
  kind,
  task,
  mutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ReasonKind;
  task: TaskRow | null;
  mutation: TaskMutation;
}) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("ready");
  const copy = REASON_COPY[kind];

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTarget(task?.status === "complete" ? "in_progress" : "ready");
  }, [open, task]);

  if (!task) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (copy.required && !text) return;

    let ok = false;
    if (kind === "block") {
      ok = await mutation.run(
        "task.block",
        { taskId: task.id, reason: text },
        `Block ${task.id}`,
        task.id,
      );
    } else if (kind === "cancel") {
      ok = await mutation.run(
        "task.cancel",
        { taskId: task.id, reason: text },
        `Cancel ${task.id}`,
        task.id,
      );
    } else if (kind === "reopen") {
      ok = await mutation.run(
        "task.reopen",
        { taskId: task.id, reason: text, to: target },
        `Reopen ${task.id}`,
        task.id,
      );
    } else if (kind === "release") {
      ok = await mutation.run(
        "task.release",
        text ? { taskId: task.id, reason: text } : { taskId: task.id },
        `Release the claim on ${task.id}`,
        task.id,
      );
    } else {
      ok = await mutation.run(
        "task.complete",
        text ? { taskId: task.id, note: text } : { taskId: task.id },
        `Complete ${task.id}`,
        task.id,
      );
    }
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="font-prose text-small text-ink-2">
            {task.name}{" "}
            <span className="font-chassis text-chassis-sm text-ink-3">
              {task.id}
            </span>
          </p>

          <Field label={copy.label} required={copy.required}>
            {(id) => (
              <Textarea
                id={id}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                autoFocus
                required={copy.required}
              />
            )}
          </Field>

          {kind === "reopen" ? (
            <Field
              label="Put it back into"
              hint="Ready means it is waiting to be picked up. In Progress means work resumes now."
            >
              {(id) => (
                <OptionSelect
                  id={id}
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: "ready", label: "Ready", count: 0 },
                    { value: "in_progress", label: "In Progress", count: 0 },
                  ]}
                  placeholder="Choose a status"
                />
              )}
            </Field>
          ) : null}

          {mutation.refusal ? (
            <p
              role="alert"
              className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash p-2 font-prose text-small text-ink prose-measure"
            >
              {mutation.refusal.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Keep it as it is
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.pending !== null || (copy.required && !reason.trim())
              }
            >
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
   Claim
   --------------------------------------------------------------------------- */

export function ClaimDialog({
  open,
  onOpenChange,
  task,
  index,
  mutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  index: TaskIndex;
  mutation: TaskMutation;
}) {
  const [developerId, setDeveloperId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    if (!open) return;
    setDeveloperId("");
    setAgentId("");
    setBranchId("");
  }, [open]);

  if (!task) return null;

  const developerOptions: Option[] = [...index.developerById.values()].map(
    (developer) => ({
      value: developer.id,
      label: developer.display_name,
      count:
        index.options.developer.find((option) => option.value === developer.id)
          ?.count ?? 0,
    }),
  );
  const agentOptions: Option[] = index.options.agent.length
    ? index.options.agent
    : [...index.agentById.values()].map((agent) => ({
        value: agent.id,
        label: `${titleCase(agent.harness)}${agent.model_label ? ` (${agent.model_label})` : ""}`,
        count: 0,
      }));
  const branchOptions: Option[] = [...index.branchById.values()].map(
    (branch) => ({
      value: branch.id,
      label: branch.name,
      count:
        index.options.branch.find((option) => option.value === branch.id)
          ?.count ?? 0,
    }),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = { taskId: task.id };
    if (developerId) payload.developerId = developerId;
    if (agentId) payload.agentId = agentId;
    if (branchId) payload.branchId = branchId;
    const ok = await mutation.run(
      "task.claim",
      payload,
      `Claim ${task.id}`,
      task.id,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim this task</DialogTitle>
          <DialogDescription>
            One claim at a time. Naming the developer, agent and branch is
            optional, and it is what makes the Team view able to say who is on
            what.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="font-prose text-small text-ink-2">
            {task.name}{" "}
            <span className="font-chassis text-chassis-sm text-ink-3">
              {task.id}
            </span>
          </p>

          <Field label="Developer">
            {(id) => (
              <OptionSelect
                id={id}
                value={developerId}
                onChange={setDeveloperId}
                emptyLabel="Not recorded"
                options={developerOptions}
                placeholder="Choose a developer"
              />
            )}
          </Field>
          <Field label="Agent">
            {(id) => (
              <OptionSelect
                id={id}
                value={agentId}
                onChange={setAgentId}
                emptyLabel="Not recorded"
                options={agentOptions}
                placeholder="Choose an agent"
              />
            )}
          </Field>
          <Field label="Branch">
            {(id) => (
              <OptionSelect
                id={id}
                value={branchId}
                onChange={setBranchId}
                emptyLabel="Not recorded"
                options={branchOptions}
                placeholder="Choose a branch"
              />
            )}
          </Field>

          {mutation.refusal ? (
            <p
              role="alert"
              className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash p-2 font-prose text-small text-ink prose-measure"
            >
              {mutation.refusal.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.pending !== null}>
              Claim it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
   Link a contract
   --------------------------------------------------------------------------- */

export function LinkDialog({
  open,
  onOpenChange,
  task,
  mutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  mutation: TaskMutation;
}) {
  const [targetType, setTargetType] = useState("workflow_step");
  const [targetId, setTargetId] = useState("");
  const [relationship, setRelationship] = useState("implements");

  useEffect(() => {
    if (!open) return;
    setTargetType("workflow_step");
    setTargetId("");
    setRelationship("implements");
  }, [open]);

  if (!task) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = targetId.trim().toUpperCase();
    if (!id) return;
    const ok = await mutation.run(
      "task.link",
      { taskId: task.id, targetType, targetId: id, relationship },
      `Link ${task.id} to ${contractTargetLabel(targetType)} ${id}`,
      task.id,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Say what this task implements</DialogTitle>
          <DialogDescription>
            A task cannot leave Draft until it points at one part of the product
            contract. That link is what lets the product say the work was for
            something rather than merely done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="font-prose text-small text-ink-2">
            {task.name}{" "}
            <span className="font-chassis text-chassis-sm text-ink-3">
              {task.id}
            </span>
          </p>

          <Field label="Kind of contract">
            {(id) => (
              <OptionSelect
                id={id}
                value={targetType}
                onChange={setTargetType}
                options={CONTRACT_TARGET_TYPES.map((value) => ({
                  value,
                  label: CONTRACT_TARGET_LABELS[value],
                  count: 0,
                }))}
                placeholder="Choose what this implements"
              />
            )}
          </Field>

          <Field
            label="Record identifier"
            required
            hint="The id of the record it implements, for example FEAT-0007 or DEC-0003. The service refuses an id that does not exist."
          >
            {(id) => (
              <Input
                id={id}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                placeholder="TASK-0012"
                required
                autoFocus
              />
            )}
          </Field>

          <Field label="Relationship">
            {(id) => (
              <OptionSelect
                id={id}
                value={relationship}
                onChange={setRelationship}
                options={CONTRACT_RELATIONSHIPS.map((value) => ({
                  value,
                  label: relationshipLabel(value),
                  count: 0,
                }))}
                placeholder="Choose a relationship"
              />
            )}
          </Field>

          {mutation.refusal ? (
            <p
              role="alert"
              className="rounded-sd border border-state-blocked/45 bg-state-blocked-wash p-2 font-prose text-small text-ink prose-measure"
            >
              {mutation.refusal.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.pending !== null || !targetId.trim()}>
              Link it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
   Keyboard reference
   --------------------------------------------------------------------------- */

export interface ShortcutEntry {
  keys: string;
  description: string;
}

export const NAVIGATION_SHORTCUTS: ShortcutEntry[] = [
  { keys: "Up and Down", description: "Move the selection through the tasks" },
  {
    keys: "Left and Right",
    description:
      "On the board, move between status columns. In the hierarchy, collapse and expand a parent",
  },
  { keys: "Home and End", description: "Jump to the first or last task" },
  { keys: "Enter", description: "Open the selected task" },
  { keys: "Escape", description: "Close the task panel" },
  { keys: "Slash", description: "Jump to the search box" },
  { keys: "n", description: "Create a task" },
  { keys: "1, 2, 3", description: "Switch to list, board or hierarchy" },
  { keys: "Question mark", description: "Show this list" },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            These work whenever the task list has focus and you are not typing in
            a box. Every one of them has a visible control too.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <ShortcutGroup title="Moving around" entries={NAVIGATION_SHORTCUTS} />
          <ShortcutGroup
            title="Acting on the selected task"
            entries={TASK_ACTIONS.map((action) => ({
              keys: action.shortcut,
              description: `${action.label}. ${action.hint}`,
            }))}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutGroup({
  title,
  entries,
}: {
  title: string;
  entries: ShortcutEntry[];
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-chassis text-label text-ink-3 uppercase">{title}</h3>
      <dl className="flex flex-col divide-y divide-rule border-y border-rule">
        {entries.map((entry) => (
          <div
            key={entry.keys + entry.description}
            className="flex items-start gap-3 py-1.5"
          >
            <dt className="w-28 shrink-0">
              <kbd className="rounded-sd-sm border border-rule bg-inset px-1.5 py-0.5 font-chassis text-chassis-sm text-ink-2">
                {entry.keys}
              </kbd>
            </dt>
            <dd className="min-w-0 flex-1 font-prose text-small text-ink-2">
              {entry.description}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   The action row shown on an open task
   --------------------------------------------------------------------------- */

export function TaskActionBar({
  task,
  onAction,
  pending,
  className,
}: {
  task: TaskRow;
  onAction: (id: TaskActionId) => void;
  pending: string | null;
  className?: string;
}) {
  const available = TASK_ACTIONS.filter((action) =>
    isActionAvailable(action.id, task),
  );
  const unavailable = TASK_ACTIONS.filter(
    (action) => !isActionAvailable(action.id, task),
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {available.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              size="sm"
              variant={action.primary ? "outline" : "ghost"}
              onClick={() => onAction(action.id)}
              disabled={pending !== null}
              title={`${action.hint} Shortcut: ${action.shortcut}`}
              aria-keyshortcuts={action.shortcut}
            >
              <Icon />
              {action.label}
              <kbd
                aria-hidden="true"
                className="ml-0.5 hidden rounded-sd-sm border border-rule bg-inset px-1 font-chassis text-[10px] text-ink-3 sm:inline"
              >
                {action.shortcut}
              </kbd>
            </Button>
          );
        })}
      </div>
      {pending ? (
        <p role="status" className="font-prose text-small text-ink-2">
          {pending}. Waiting for the service to confirm.
        </p>
      ) : null}
      {unavailable.length > 0 ? (
        <details className="group">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-sd font-chassis text-chassis-sm text-ink-3 focus-ring hover:text-ink-2">
            <ShieldQuestion className="size-3.5" aria-hidden="true" />
            {countPhrase(unavailable.length, "action")} not possible right now
          </summary>
          <ul className="flex flex-col gap-1 pt-1.5">
            {unavailable.map((action) => (
              <li
                key={action.id}
                className="font-prose text-small text-ink-3 prose-measure"
              >
                <span className="font-chassis text-chassis-sm text-ink-2">
                  {action.label}:
                </span>{" "}
                {unavailableReason(action.id, task)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
