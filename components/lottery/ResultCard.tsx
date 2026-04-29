"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LotteryConfig, LotteryResult, MatchResult } from "@/lib/types";
import { formatCurrency } from "@/lib/lottery-utils";
import {
  Trophy,
  MapPin,
  Calendar,
  TrendingUp,
  DollarSign,
  Clover,
  PartyPopper,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultCardProps {
  result: LotteryResult;
  config: LotteryConfig;
  matchResult?: MatchResult | null;
}

export function ResultCard({ result, config, matchResult }: ResultCardProps) {
  const drawnNumbers = (result.listaDezenas || []).map((d) => parseInt(d, 10));
  const matchedNumbers = matchResult?.matchedNumbers || [];
  const matchedTrevos = matchResult?.matchedTrevos || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <div
          className="h-2"
          style={{ backgroundColor: config.color }}
        />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <span style={{ color: config.color }}>Resultado</span>
              <span className="text-muted-foreground font-normal text-base">
                Concurso {result.numero}
              </span>
              <span className="text-muted-foreground font-normal text-sm">
                ({result.dataApuracao})
              </span>
            </CardTitle>
            {result.acumulado && (
              <Badge
                variant="warning"
                className="self-start sm:self-auto animate-pulse"
              >
                Acumulou!
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>
              Sorteio realizado no {result.localSorteio} em{" "}
              {result.nomeMunicipioUFSorteio}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Números sorteados */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Números Sorteados
            </h4>
            <div className="flex flex-wrap gap-2">
              {drawnNumbers.map((num, idx) => {
                const isMatched = matchedNumbers.includes(num);
                return (
                  <motion.span
                    key={`${num}-${idx}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full text-sm font-bold transition-all",
                      isMatched
                        ? "text-white ring-2 ring-offset-2 ring-green-500 scale-110"
                        : "bg-muted text-foreground"
                    )}
                    style={
                      isMatched
                        ? {
                            backgroundColor: "#16a34a",
                            boxShadow: "0 2px 12px rgba(22,163,74,0.4)",
                          }
                        : undefined
                    }
                  >
                    {num.toString().padStart(2, "0")}
                  </motion.span>
                );
              })}
            </div>
          </div>

          {/* Trevos sorteados (+Milionária) */}
          {result.listaTrevosSorteados &&
            result.listaTrevosSorteados.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <Clover className="h-4 w-4" /> Trevos Sorteados
                </h4>
                <div className="flex gap-2">
                  {result.listaTrevosSorteados.map((t, idx) => {
                    const num = parseInt(t, 10);
                    const isMatched = matchedTrevos.includes(num);
                    return (
                      <motion.span
                        key={`trevo-${num}-${idx}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                          "inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold",
                          isMatched
                            ? "bg-emerald-600 text-white ring-2 ring-offset-2 ring-emerald-400"
                            : "bg-emerald-100 text-emerald-800"
                        )}
                      >
                        {num}
                      </motion.span>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Resultado do cruzamento */}
          {matchResult && (
            <>
              <Separator />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "rounded-xl p-4 space-y-2",
                  matchResult.isWinner
                    ? "bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800"
                    : "bg-muted/50 border border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  {matchResult.isWinner ? (
                    <PartyPopper className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "font-bold text-base",
                      matchResult.isWinner
                        ? "text-green-700 dark:text-green-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {matchResult.isWinner
                      ? "Parabéns! Você foi contemplado!"
                      : "Não foi dessa vez..."}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" style={{ color: config.color }} />
                    <strong>{matchResult.matchCount}</strong> acerto
                    {matchResult.matchCount !== 1 ? "s" : ""}
                  </span>
                  {matchResult.trevoMatchCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Clover className="h-4 w-4 text-emerald-600" />
                      <strong>{matchResult.trevoMatchCount}</strong> trevo
                      {matchResult.trevoMatchCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {matchResult.isWinner && matchResult.prizeInfo && (
                    <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                      <DollarSign className="h-4 w-4" />
                      Prêmio: <strong>{formatCurrency(matchResult.prizeInfo.valorPremio)}</strong>
                      ({matchResult.prizeInfo.descricaoFaixa})
                    </span>
                  )}
                </div>

                {/* Meus números vs resultado */}
                {matchResult.game && (
                  <div className="mt-2 space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      Seus números:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchResult.game.numeros.map((num) => {
                        const isHit = matchedNumbers.includes(num);
                        return (
                          <span
                            key={`my-${num}`}
                            className={cn(
                              "inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold",
                              isHit
                                ? "text-white"
                                : "bg-muted text-muted-foreground line-through opacity-50"
                            )}
                            style={
                              isHit
                                ? { backgroundColor: config.color }
                                : undefined
                            }
                          >
                            {num.toString().padStart(2, "0")}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}

          <Separator />

          {/* Premiação */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: config.color }}>
              <Trophy className="h-4 w-4" />
              Premiação
            </h4>
            <div className="space-y-2">
              {(result.listaRateioPremio || []).map((prize) => {
                const isMyPrize =
                  matchResult?.prizeInfo?.faixa === prize.faixa;
                return (
                  <div
                    key={prize.faixa}
                    className={cn(
                      "rounded-xl p-3 text-sm transition-colors",
                      isMyPrize
                        ? "bg-green-50 border-2 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                        : "bg-muted/30 border border-border/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isMyPrize && (
                          <PartyPopper className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            isMyPrize
                              ? "text-green-700 dark:text-green-400"
                              : "text-foreground"
                          )}
                        >
                          {prize.descricaoFaixa}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {prize.numeroDeGanhadores === 0
                          ? "Nenhum acertador"
                          : `${prize.numeroDeGanhadores} ganhador${
                              prize.numeroDeGanhadores > 1 ? "es" : ""
                            }`}
                      </span>
                      <span
                        className={cn(
                          "font-bold tabular-nums text-base",
                          isMyPrize
                            ? "text-green-700 dark:text-green-400"
                            : "text-foreground"
                        )}
                      >
                        {formatCurrency(prize.valorPremio)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Informações adicionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground block text-xs">
                  Arrecadação total
                </span>
                <span className="font-semibold">
                  {formatCurrency(result.valorArrecadado)}
                </span>
              </div>
            </div>

            {result.valorEstimadoProximoConcurso > 0 && (
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Estimativa próximo concurso
                    {result.dataProximoConcurso && (
                      <> ({result.dataProximoConcurso})</>
                    )}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(result.valorEstimadoProximoConcurso)}
                  </span>
                </div>
              </div>
            )}

            {result.valorAcumuladoProximoConcurso > 0 && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Acumulado próximo concurso
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(result.valorAcumuladoProximoConcurso)}
                  </span>
                </div>
              </div>
            )}

            {result.valorAcumuladoConcursoEspecial > 0 && (
              <div className="flex items-start gap-2">
                <Trophy className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Acumulado concurso especial
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(result.valorAcumuladoConcursoEspecial)}
                  </span>
                </div>
              </div>
            )}

            {result.valorAcumuladoConcurso_0_5 > 0 && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Acumulado final 0/5
                    {result.numeroConcursoFinal_0_5 > 0 && (
                      <> (Concurso {result.numeroConcursoFinal_0_5})</>
                    )}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(result.valorAcumuladoConcurso_0_5)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
