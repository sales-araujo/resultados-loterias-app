"use client";

import { cn } from "@/lib/utils";
import { LotteryConfig } from "@/lib/types";
import { motion } from "framer-motion";

interface NumberInputProps {
  config: LotteryConfig;
  selectedNumbers: number[];
  onToggle: (num: number) => void;
  disabled?: boolean;
}

export function NumberInput({
  config,
  selectedNumbers,
  onToggle,
  disabled,
}: NumberInputProps) {
  const start = config.numberRange.min;
  const end = config.numberRange.max;
  const numbers: number[] = [];
  for (let i = start; i <= end; i++) {
    numbers.push(i);
  }

  const maxSelected = config.betMax;
  const isMaxReached = selectedNumbers.length >= maxSelected;

  const columns = end <= 25 ? 5 : end <= 50 ? 10 : end <= 80 ? 10 : 10;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Selecione de{" "}
          <strong className="text-foreground">{config.betMin}</strong> a{" "}
          <strong className="text-foreground">{config.betMax}</strong> números
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            selectedNumbers.length >= config.betMin
              ? "text-green-600"
              : "text-muted-foreground",
            selectedNumbers.length > config.betMax && "text-red-500"
          )}
        >
          {selectedNumbers.length}/{config.betMax}
        </span>
      </div>

      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {numbers.map((num) => {
          const isSelected = selectedNumbers.includes(num);
          const isDisabled = disabled || (!isSelected && isMaxReached);

          return (
            <motion.button
              key={num}
              whileTap={{ scale: 0.9 }}
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(num)}
              className={cn(
                "relative flex items-center justify-center rounded-lg text-xs sm:text-sm font-bold h-9 sm:h-10 transition-all duration-150 select-none",
                isSelected
                  ? "text-white shadow-md scale-105"
                  : "bg-muted/60 text-foreground hover:bg-muted border border-border/50",
                isDisabled && !isSelected && "opacity-40 cursor-not-allowed"
              )}
              style={
                isSelected
                  ? {
                      backgroundColor: config.color,
                      boxShadow: `0 2px 8px ${config.color}40`,
                    }
                  : undefined
              }
            >
              {config.zeroBased
                ? num.toString().padStart(2, "0")
                : num.toString().padStart(2, "0")}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
