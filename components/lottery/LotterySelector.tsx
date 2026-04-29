"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOTTERY_LIST } from "@/lib/lottery-config";

interface LotterySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function LotterySelector({ value, onValueChange }: LotterySelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full h-12 text-base">
        <SelectValue placeholder="Selecione o jogo" />
      </SelectTrigger>
      <SelectContent>
        {LOTTERY_LIST.map((lottery) => (
          <SelectItem key={lottery.id} value={lottery.id}>
            <div className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: lottery.color }}
              />
              <span className="font-medium">{lottery.displayName}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {lottery.betMin}-{lottery.betMax} de{" "}
                {lottery.numberRange.max - lottery.numberRange.min + 1}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
