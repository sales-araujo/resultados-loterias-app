"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchResult, LotteryConfig } from "@/lib/types";
import { formatCurrency } from "@/lib/lottery-utils";
import {
  Trophy,
  Target,
  DollarSign,
  Hash,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface StatsPanelProps {
  matchResults: MatchResult[];
  config: LotteryConfig;
}

export function StatsPanel({ matchResults, config }: StatsPanelProps) {
  if (matchResults.length === 0) return null;

  const totalContests = matchResults.length;
  const totalWins = matchResults.filter((r) => r.isWinner).length;
  const totalPrize = matchResults.reduce(
    (sum, r) => sum + (r.prizeInfo?.valorPremio || 0),
    0
  );
  const bestMatch = Math.max(...matchResults.map((r) => r.matchCount));
  const avgMatch =
    matchResults.reduce((sum, r) => sum + r.matchCount, 0) / totalContests;

  const stats = [
    {
      icon: Hash,
      label: "Concursos",
      value: totalContests.toString(),
      color: config.color,
    },
    {
      icon: Target,
      label: "Mais acertos",
      value: bestMatch.toString(),
      color: "#ef4444",
    },
    {
      icon: TrendingUp,
      label: "Média",
      value: avgMatch.toFixed(1),
      color: "#3b82f6",
    },
    {
      icon: CheckCircle2,
      label: "Premiado",
      value: totalWins.toString(),
      color: "#16a34a",
    },
    {
      icon: XCircle,
      label: "Sem prêmio",
      value: (totalContests - totalWins).toString(),
      color: "#9ca3af",
    },
    {
      icon: DollarSign,
      label: "Total ganho",
      value: formatCurrency(totalPrize),
      color: "#eab308",
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: config.color }} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5" style={{ color: config.color }} />
          Resumo dos Resultados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/50"
            >
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <stat.icon
                  className="h-4 w-4"
                  style={{ color: stat.color }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">
                  {stat.label}
                </p>
                <p className="text-sm font-bold truncate">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
