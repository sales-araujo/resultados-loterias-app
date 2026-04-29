"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "./NumberInput";
import { TrevoInput } from "./TrevoInput";
import { LotteryConfig, GameInsert } from "@/lib/types";
import { Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

interface GameFormProps {
  config: LotteryConfig;
  onSubmit: (game: GameInsert) => void;
  isSubmitting?: boolean;
  editMode?: boolean;
  initialData?: {
    numeros: number[];
    trevos?: number[];
    concurso_inicio: number;
    concurso_fim: number | null;
  };
}

export function GameForm({
  config,
  onSubmit,
  isSubmitting,
  editMode,
  initialData,
}: GameFormProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(
    initialData?.numeros || []
  );
  const [selectedTrevos, setSelectedTrevos] = useState<number[]>(
    initialData?.trevos || []
  );
  const [concursoInicio, setConcursoInicio] = useState<string>(
    initialData?.concurso_inicio?.toString() || ""
  );
  const [concursoFim, setConcursoFim] = useState<string>(
    initialData?.concurso_fim?.toString() || ""
  );
  const [isRange, setIsRange] = useState<boolean>(
    !!initialData?.concurso_fim
  );

  const handleToggleNumber = useCallback(
    (num: number) => {
      setSelectedNumbers((prev) => {
        if (prev.includes(num)) {
          return prev.filter((n) => n !== num);
        }
        if (prev.length >= config.betMax) return prev;
        return [...prev, num].sort((a, b) => a - b);
      });
    },
    [config.betMax]
  );

  const handleToggleTrevo = useCallback(
    (num: number) => {
      setSelectedTrevos((prev) => {
        if (prev.includes(num)) {
          return prev.filter((n) => n !== num);
        }
        if (prev.length >= (config.trevoBetMax || 2)) return prev;
        return [...prev, num].sort((a, b) => a - b);
      });
    },
    [config.trevoBetMax]
  );

  const handleReset = () => {
    setSelectedNumbers([]);
    setSelectedTrevos([]);
    setConcursoInicio("");
    setConcursoFim("");
  };

  const handleSubmit = () => {
    if (selectedNumbers.length < config.betMin) {
      toast.error(
        `Selecione pelo menos ${config.betMin} números para ${config.displayName}`
      );
      return;
    }

    if (selectedNumbers.length > config.betMax) {
      toast.error(
        `Máximo de ${config.betMax} números para ${config.displayName}`
      );
      return;
    }

    if (
      config.hasTrevos &&
      selectedTrevos.length < (config.trevoBetMin || 2)
    ) {
      toast.error(
        `Selecione pelo menos ${config.trevoBetMin} trevos para ${config.displayName}`
      );
      return;
    }

    if (!concursoInicio) {
      toast.error("Informe o número do concurso");
      return;
    }

    const inicio = parseInt(concursoInicio, 10);
    if (isNaN(inicio) || inicio <= 0) {
      toast.error("Número do concurso inválido");
      return;
    }

    let fim: number | null = null;
    if (isRange && concursoFim) {
      fim = parseInt(concursoFim, 10);
      if (isNaN(fim) || fim <= 0) {
        toast.error("Número do concurso final inválido");
        return;
      }
      if (fim < inicio) {
        toast.error(
          "O concurso final deve ser maior ou igual ao concurso inicial"
        );
        return;
      }
      if (fim - inicio > 50) {
        toast.error("O range máximo é de 50 concursos");
        return;
      }
    }

    onSubmit({
      tipo_jogo: config.id,
      numeros: selectedNumbers,
      trevos: config.hasTrevos ? selectedTrevos : null,
      concurso_inicio: inicio,
      concurso_fim: fim,
    });

    if (!editMode) {
      handleReset();
    }
  };

  return (
    <Card className="border-t-4" style={{ borderTopColor: config.color }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base sm:text-lg">
            <Plus className="h-5 w-5" />
            {editMode ? "Editar Jogo" : "Novo Jogo"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleReset}
            title="Limpar"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <NumberInput
          config={config}
          selectedNumbers={selectedNumbers}
          onToggle={handleToggleNumber}
          disabled={isSubmitting}
        />

        <AnimatePresence>
          {config.hasTrevos && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <TrevoInput
                config={config}
                selectedTrevos={selectedTrevos}
                onToggle={handleToggleTrevo}
                disabled={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label
              htmlFor="range-toggle"
              className="text-sm text-muted-foreground"
            >
              Concurso único
            </Label>
            <Switch
              id="range-toggle"
              checked={isRange}
              onCheckedChange={setIsRange}
            />
            <Label
              htmlFor="range-toggle"
              className="text-sm text-muted-foreground"
            >
              Range de concursos
            </Label>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="concurso-inicio" className="text-xs mb-1 block">
                {isRange ? "Concurso Inicial" : "Nº do Concurso"}
              </Label>
              <Input
                id="concurso-inicio"
                type="number"
                placeholder="Ex: 3672"
                value={concursoInicio}
                onChange={(e) => setConcursoInicio(e.target.value)}
                disabled={isSubmitting}
                min={1}
              />
            </div>

            <AnimatePresence>
              {isRange && (
                <motion.div
                  className="flex-1"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                >
                  <Label htmlFor="concurso-fim" className="text-xs mb-1 block">
                    Concurso Final
                  </Label>
                  <Input
                    id="concurso-fim"
                    type="number"
                    placeholder="Ex: 3680"
                    value={concursoFim}
                    onChange={(e) => setConcursoFim(e.target.value)}
                    disabled={isSubmitting}
                    min={1}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedNumbers.length < config.betMin}
          className="w-full h-11 text-base font-semibold"
          style={{
            backgroundColor: config.color,
          }}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting
            ? "Salvando..."
            : editMode
            ? "Atualizar Jogo"
            : "Cadastrar Jogo"}
        </Button>
      </CardContent>
    </Card>
  );
}
