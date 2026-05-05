"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { toast } from "sonner";

export interface ContestSearchProps {
  currentContest: number;
  minContest: number;
  maxContest: number;
  onSearch: (contest: number) => void;
  disabled?: boolean;
}

export type ValidationResult =
  | { valid: true; value: number }
  | { valid: false; reason: "empty" | "non-numeric" | "out-of-range" };

/**
 * Validates a contest search input string.
 * Returns a ValidationResult indicating whether the input is valid and parseable
 * as a contest number within the given range.
 */
export function validateContestInput(
  input: string,
  minContest: number,
  maxContest: number
): ValidationResult {
  const trimmed = input.trim();

  if (trimmed === "") {
    return { valid: false, reason: "empty" };
  }

  // Check for non-numeric characters (allow only digits)
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, reason: "non-numeric" };
  }

  const value = parseInt(trimmed, 10);

  if (isNaN(value) || value <= 0) {
    return { valid: false, reason: "non-numeric" };
  }

  if (value < minContest || value > maxContest) {
    return { valid: false, reason: "out-of-range" };
  }

  return { valid: true, value };
}

export function ContestSearch({
  currentContest,
  minContest,
  maxContest,
  onSearch,
  disabled = false,
}: ContestSearchProps) {
  const [inputValue, setInputValue] = useState(String(currentContest));

  const handleSubmit = useCallback(() => {
    const result = validateContestInput(inputValue, minContest, maxContest);

    if (!result.valid) {
      if (result.reason === "out-of-range") {
        toast.error(
          `Concurso fora do range (${minContest} - ${maxContest})`
        );
      }
      // For empty or non-numeric, silently keep current contest (Req 3.4)
      return;
    }

    onSearch(result.value);
  }, [inputValue, minContest, maxContest, onSearch]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={String(currentContest)}
        className="h-8 w-20 text-center text-xs tabular-nums px-1.5 rounded-lg"
        aria-label="Buscar concurso"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleSubmit}
        disabled={disabled}
        className="h-8 px-3 text-xs font-semibold cursor-pointer rounded-lg"
        aria-label="Pesquisar concurso"
      >
        <Search className="h-3.5 w-3.5 mr-1.5" />
        Buscar
      </Button>
    </div>
  );
}
