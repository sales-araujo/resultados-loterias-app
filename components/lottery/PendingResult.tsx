"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, RefreshCw } from "lucide-react";
import { LotteryConfig } from "@/lib/types";

interface PendingResultProps {
  contestNumber: number;
  config: LotteryConfig;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function PendingResult({
  contestNumber,
  config,
  isError,
  errorMessage,
  onRetry,
}: PendingResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <div className="h-2" style={{ backgroundColor: config.color }} />
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <motion.div
              animate={
                isError
                  ? {}
                  : {
                      rotate: [0, 10, -10, 0],
                      transition: { repeat: Infinity, duration: 2 },
                    }
              }
            >
              {isError ? (
                <AlertCircle className="h-16 w-16 text-destructive/60" />
              ) : (
                <Clock
                  className="h-16 w-16"
                  style={{ color: `${config.color}80` }}
                />
              )}
            </motion.div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                {isError
                  ? "Erro ao buscar resultado"
                  : "Resultado ainda não disponível"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {isError
                  ? errorMessage?.includes("proxy") || errorMessage?.includes("conectar")
                    ? "Problema temporário de conexão. Isso pode acontecer no modo offline ou com conexão instável. Tente novamente em alguns instantes."
                    : errorMessage ||
                      "Ocorreu um erro ao buscar o resultado. Verifique sua conexão e tente novamente."
                  : `O concurso ${contestNumber} da ${config.displayName} ainda não foi apurado. O resultado será disponibilizado após o sorteio.`}
              </p>
            </div>

            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${config.color}15`,
                color: config.color,
              }}
            >
              <span>Concurso {contestNumber}</span>
            </div>

            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="mt-2 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
