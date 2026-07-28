/**
 * A select you can type into.
 *
 * A plain select is fine for a handful of fixed choices. It stops being fine
 * the moment the list is long or open-ended: task categories are twenty-one
 * before a project adds its own, and features and modules grow for the life of
 * the project. Scrolling a list of forty to find one entry is not a choice
 * anyone should have to make when they already know the name.
 *
 * Keyboard behavior comes from cmdk: typing filters, arrows move, enter picks,
 * escape closes and returns focus to the trigger.
 */

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown in dimmer text beside the label: a meaning, a count, a route. */
  hint?: string | null;
  /** Kept out of the visible label but still matched when typing. */
  keywords?: string[];
  disabled?: boolean;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Choose one",
  emptyLabel,
  searchPlaceholder = "Type to filter",
  /** Below this many options the search box is hidden: it would be noise. */
  searchThreshold = 8,
  disabled,
  id,
  className,
  "aria-describedby": describedBy,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** The entry that clears the value. Omitted when the field is required. */
  emptyLabel?: string;
  searchPlaceholder?: string;
  searchThreshold?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const entries: ComboboxOption[] = emptyLabel
    ? [{ value: "", label: emptyLabel }, ...options]
    : options;

  const selected = entries.find((option) => option.value === value);
  const showSearch = entries.length >= searchThreshold;

  // Returning focus to the trigger is what makes escape and enter feel like a
  // native select rather than a popup that drops the caret somewhere else.
  useEffect(() => {
    if (!open) triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-describedby={describedBy}
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-sd border border-rule bg-inset px-2.5 font-chassis text-chassis text-ink transition-colors duration-[120ms] ease-sd focus-ring",
          "hover:bg-panel-raised disabled:cursor-not-allowed disabled:opacity-55",
          className,
        )}
      >
        <span className={cn("truncate", !selected?.value && "text-ink-3")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
      </PopoverTrigger>

      <PopoverContent className="p-0">
        <Command
          // Matching the hint and the keywords too means someone can find
          // "Design" by typing "surface", which is how people actually search.
          filter={(itemValue, search, keywords) => {
            const haystack = [itemValue, ...(keywords ?? [])]
              .join(" ")
              .toLowerCase();
            return haystack.includes(search.trim().toLowerCase()) ? 1 : 0;
          }}
        >
          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-rule px-2.5">
              <Search aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
              <CommandInput
                placeholder={searchPlaceholder}
                className="h-9 border-0 px-0"
              />
            </div>
          ) : null}
          <CommandList className="max-h-64">
            <CommandEmpty>
              Nothing here matches that. Try a shorter word.
            </CommandEmpty>
            <CommandGroup>
              {entries.map((option) => (
                <CommandItem
                  key={option.value || "__none__"}
                  value={`${option.label} ${option.hint ?? ""}`}
                  keywords={[option.value, ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="ml-auto truncate pl-3 font-prose text-small text-ink-3">
                      {option.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
