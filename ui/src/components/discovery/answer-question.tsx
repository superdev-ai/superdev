/**
 * Answering an open question, from its own options or in your own words.
 *
 * The options have been on the record since the first migration and both surfaces
 * treated them as prose: this view folded them into a read-only list and offered
 * no way to answer at all, so somebody holding a question with four worked-out
 * options had to retype one of them at a terminal.
 *
 * Three things make an option answerable rather than readable.
 *
 * Selecting it, exclusively or not, according to the question. Some questions
 * take one answer and some take several: "which database" is one, "which outside
 * services" is usually more, and forcing one answer to the second gets a wrong
 * answer rather than an incomplete one. The control follows the question, so a
 * radio group and a checkbox group are the same component reading `select_mode`.
 *
 * A tag on the recommended option, with the reason beside it. A recommendation
 * with no reason is an instruction, and the reason is the only thing that lets
 * somebody disagree with it deliberately. Questions where nothing is genuinely
 * recommendable carry no tag rather than a default dressed as advice.
 *
 * Typing an answer, always available, never hidden behind the options running
 * out. The options are a shared vocabulary, not the boundary of what is true, and
 * an option can be selected and then qualified in words.
 */

import { Check, CircleDot, Pencil } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, postMutation } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

/** The typed-answer choice is a control, not one of the question's options. */
const TYPE_YOUR_OWN = "__type_your_own__";

interface AnswerQuestionProps {
  question: Question;
  /** Re-read the project once the answer lands, so every count agrees again. */
  onAnswered: () => void;
}

export function AnswerQuestion({ question, onAnswered }: AnswerQuestionProps) {
  const groupName = useId();
  const typedFieldId = useId();
  const options = useMemo(() => question.alternatives_json ?? [], [question.alternatives_json]);
  const recommended = useMemo(
    () => new Set(question.recommended_json ?? []),
    [question.recommended_json],
  );
  const many = question.select_mode === "many";

  // The recommended options start selected, which is what makes a recommendation
  // act like one. Nothing is submitted until somebody presses the button, so this
  // proposes rather than decides.
  const [selected, setSelected] = useState<string[]>(() =>
    options.filter((option) => recommended.has(option)),
  );
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const toggle = useCallback(
    (option: string) => {
      setRefusal(null);
      setSelected((current) =>
        many
          ? current.includes(option)
            ? current.filter((value) => value !== option)
            : [...current, option]
          : [option],
      );
      // Choosing an option on a one-answer question puts the typed answer away as
      // a qualification rather than clearing it: the words may still apply.
      if (!many) setTyping((open) => open);
    },
    [many],
  );

  const chooseTyping = useCallback(() => {
    setRefusal(null);
    setTyping(true);
    if (!many) setSelected([]);
  }, [many]);

  const ready = selected.length > 0 || typed.trim().length > 0;

  const submit = useCallback(async () => {
    if (!ready) {
      setRefusal("Choose an option or type an answer. An empty answer would record nothing while looking like a decision.");
      return;
    }
    setPending(true);
    setRefusal(null);
    try {
      await postMutation("question.answer", {
        questionId: question.id,
        status: "answered",
        selected,
        answer: typed.trim() || undefined,
      });
      onAnswered();
    } catch (error) {
      // The service answers a refusal in a sentence. It is shown as written.
      setRefusal(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The service did not say what went wrong. Check the service log, then try again.",
      );
    } finally {
      setPending(false);
    }
  }, [onAnswered, question.id, ready, selected, typed]);

  if (!options.length && !question.recommendation) {
    // A question with no options is answered in words alone, and the textarea is
    // shown outright rather than behind a choice that has nothing to choose from.
    return (
      <TypedOnly
        fieldId={typedFieldId}
        value={typed}
        onChange={(value) => {
          setTyped(value);
          setRefusal(null);
        }}
        onSubmit={submit}
        pending={pending}
        refusal={refusal}
        ready={ready}
      />
    );
  }

  return (
    <fieldset className="mt-1.5 flex flex-col gap-1.5 border-0 p-0">
      <legend className="font-chassis text-chassis-sm text-ink-3">
        {many
          ? "Choose everything that applies, or type an answer"
          : "Choose one, or type an answer"}
      </legend>

      <ul className="flex flex-col gap-1">
        {options.map((option) => {
          const isRecommended = recommended.has(option);
          const checked = selected.includes(option);
          return (
            <li key={option}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-sd border px-2 py-1.5 transition-colors duration-[120ms] ease-sd",
                  checked
                    ? "border-signal-edge bg-signal-wash"
                    : "border-rule bg-transparent hover:bg-inset",
                )}
              >
                <input
                  type={many ? "checkbox" : "radio"}
                  name={many ? undefined : groupName}
                  checked={checked}
                  onChange={() => toggle(option)}
                  className="mt-0.5 size-3.5 shrink-0 accent-[var(--signal)] focus-ring"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-prose text-small text-ink-1">{option}</span>
                    {isRecommended ? (
                      <Badge variant="signal">
                        <Check aria-hidden="true" />
                        Recommended
                      </Badge>
                    ) : null}
                  </span>
                  {/*
                    The reason sits under the option it belongs to, not in a
                    footnote, because that is where somebody deciding is looking.
                  */}
                  {isRecommended && question.recommendation_why ? (
                    <span className="font-prose text-small text-ink-2 prose-measure">
                      Why: {question.recommendation_why}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}

        <li>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-sd border px-2 py-1.5 transition-colors duration-[120ms] ease-sd",
              typing ? "border-signal-edge bg-signal-wash" : "border-rule hover:bg-inset",
            )}
          >
            <input
              type={many ? "checkbox" : "radio"}
              name={many ? undefined : groupName}
              value={TYPE_YOUR_OWN}
              checked={typing}
              onChange={() => (typing ? setTyping(false) : chooseTyping())}
              className="mt-0.5 size-3.5 shrink-0 accent-[var(--signal)] focus-ring"
            />
            <span className="flex items-center gap-1.5 font-prose text-small text-ink-1">
              <Pencil aria-hidden="true" className="size-3 text-ink-3" />
              Type the answer
            </span>
          </label>
        </li>
      </ul>

      {typing ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={typedFieldId}
            className="font-chassis text-chassis-sm text-ink-3"
          >
            {selected.length
              ? "What the chosen option does not say"
              : "The answer, in your own words"}
          </label>
          <Textarea
            id={typedFieldId}
            value={typed}
            rows={3}
            onChange={(event) => {
              setTyped(event.target.value);
              setRefusal(null);
            }}
            placeholder={
              question.recommendation
                ? `For example: ${question.recommendation}`
                : "What is true, in one or two sentences."
            }
          />
        </div>
      ) : null}

      {refusal ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 font-prose text-small text-ink-1 prose-measure"
        >
          <CircleDot aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-ink-3" />
          {refusal}
        </p>
      ) : null}

      <span className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !ready}>
          {pending ? "Recording" : "Record this answer"}
        </Button>
        {/*
          Answering settles the capability area behind the question, and that is
          worth saying: it is the difference between the readiness checklist moving
          and a sentence being stored.
        */}
        <span className="font-chassis text-chassis-sm text-ink-3">
          Recording it settles the readiness area this question belongs to
        </span>
      </span>
    </fieldset>
  );
}

interface TypedOnlyProps {
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  refusal: string | null;
  ready: boolean;
}

/** A question with nothing to choose from is still answerable. */
function TypedOnly({
  fieldId,
  value,
  onChange,
  onSubmit,
  pending,
  refusal,
  ready,
}: TypedOnlyProps) {
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <label htmlFor={fieldId} className="font-chassis text-chassis-sm text-ink-3">
        The answer, in your own words
      </label>
      <Textarea
        id={fieldId}
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        placeholder="What is true, in one or two sentences."
      />
      {refusal ? (
        <p role="alert" className="font-prose text-small text-ink-1 prose-measure">
          {refusal}
        </p>
      ) : null}
      <span>
        <Button size="sm" onClick={onSubmit} disabled={pending || !ready}>
          {pending ? "Recording" : "Record this answer"}
        </Button>
      </span>
    </div>
  );
}
