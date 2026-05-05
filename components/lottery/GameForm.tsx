"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "./NumberInput";
import { TrevoInput } from "./TrevoInput";
import { LotteryConfig, GameInsert } from "@/lib/types";
import { Plus, RotateCcw, Save, X } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(!!editMode);
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

  const handleClose = () => {
    handleReset();
    setIsOpen(false);
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
      setIsOpen(false);
    }
  };

  // Collapsed state: show the "Novo Jogo" button
  if (!isOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="w-full h-14 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          style={{
            backgroundColor: config.color,
            color: "#fff",
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Jogo
        </Button>
      </motion.div>
    );
  }

  // Expanded state: full form
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-2xl border shadow-lg overflow-hidden"
        style={{ borderColor: `${config.color}30` }}
      >
        {/* Form Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: `${config.color}10` }}
        >
          <span className="flex items-center gap-2 text-sm font-bold" style={{ color: config.color }}>
            <Plus className="h-4 w-4" />
            {editMode ? "Editar Jogo" : "Novo Jogo"} — {config.displayName}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleReset}
              title="Limpar"
              className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            {!editMode && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                title="Fechar"
                className="cursor-pointer h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4 bg-card">
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
            className="w-full h-12 text-base font-bold rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
