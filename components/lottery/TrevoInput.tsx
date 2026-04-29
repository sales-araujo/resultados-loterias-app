"use client";

import { cn } from "@/lib/utils";
import { LotteryConfig } from "@/lib/types";
import { motion } from "framer-motion";
import { Clover } from "lucide-react";

interface TrevoInputProps {
  config: LotteryConfig;
  selectedTrevos: number[];
  onToggle: (num: number) => void;
  disabled?: boolean;
}

export function TrevoInput({
  config,
  selectedTrevos,
  onToggle,
  disabled,
}: TrevoInputProps) {
  if (!config.hasTrevos || !config.trevoRange) return null;

  const start = config.trevoRange.min;
  const end = config.trevoRange.max;
  const numbers: number[] = [];
  for (let i = start; i <= end; i++) {
    numbers.push(i);
  }

  const maxSelected = config.trevoBetMax || 2;
  const isMaxReached = selectedTrevos.length >= maxSelected;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Clover className="h-4 w-4" />
          Selecione de{" "}
          <strong className="text-foreground">
            {config.trevoBetMin}
          </strong>{" "}
          a <strong className="text-foreground">{config.trevoBetMax}</strong>{" "}
          trevos
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            selectedTrevos.length >= (config.trevoBetMin || 2)
              ? "text-green-600"
              : "text-muted-foreground"
          )}
        >
          {selectedTrevos.length}/{maxSelected}
        </span>
      </div>

      <div className="flex gap-2 justify-center">
        {numbers.map((num) => {
          const isSelected = selectedTrevos.includes(num);
          const isDisabled = disabled || (!isSelected && isMaxReached);

          return (
            <motion.button
              key={num}
              whileTap={{ scale: 0.9 }}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(num)}
              className={cn(
                "relative flex items-center justify-center rounded-xl text-sm font-bold h-12 w-12 transition-all duration-150 select-none",
                isSelected
                  ? "bg-emerald-600 text-white shadow-md scale-105"
                  : "bg-muted/60 text-foreground hover:bg-muted border border-border/50",
                isDisabled && !isSelected && "opacity-40 cursor-not-allowed"
              )}
            >
              {num}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
