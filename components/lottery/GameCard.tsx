"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Game, LotteryConfig } from "@/lib/types";
import { Trash2, Search, Clover, Pencil, Check, X } from "lucide-react";

interface GameCardProps {
  game: Game;
  config: LotteryConfig;
  onDelete: (id: string) => void;
  onSearch: (game: Game) => void;
  onUpdateContest?: (id: string, inicio: number, fim: number | null) => void;
  isDeleting?: boolean;
  ended?: boolean;
}

export function GameCard({
  game,
  config,
  onDelete,
  onSearch,
  onUpdateContest,
  isDeleting,
  ended,
}: GameCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editInicio, setEditInicio] = useState(game.concurso_inicio.toString());
  const [editFim, setEditFim] = useState(game.concurso_fim?.toString() || "");

  const rangeText = game.concurso_fim
    ? `Concursos ${game.concurso_inicio} a ${game.concurso_fim}`
    : `Concurso ${game.concurso_inicio}`;

  const handleSaveContest = () => {
    const inicio = parseInt(editInicio, 10);
    const fim = editFim ? parseInt(editFim, 10) : null;
    if (!inicio || inicio < 1) return;
    if (fim !== null && fim < inicio) return;
    onUpdateContest?.(game.id, inicio, fim);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditInicio(game.concurso_inicio.toString());
    setEditFim(game.concurso_fim?.toString() || "");
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
      className={`w-full min-w-0 shrink-0${ended ? " opacity-50 grayscale" : ""}`}
    >
      <Card className="overflow-hidden">
        <div
          className="h-1.5"
          style={{ backgroundColor: config.color }}
        />
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  type="number"
                  value={editInicio}
                  onChange={(e) => setEditInicio(e.target.value)}
                  className="h-7 w-20 text-xs px-2"
                  placeholder="Início"
                  min={1}
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="number"
                  value={editFim}
                  onChange={(e) => setEditFim(e.target.value)}
                  className="h-7 w-20 text-xs px-2"
                  placeholder="Fim"
                  min={1}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSaveContest}
                  className="cursor-pointer text-green-600 hover:text-green-700 shrink-0"
                  title="Salvar"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCancelEdit}
                  className="cursor-pointer text-muted-foreground shrink-0"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge
                  className="text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: `${config.color}20`,
                    color: config.color,
                    borderColor: `${config.color}40`,
                  }}
                  onClick={() => setIsEditing(true)}
                  title="Clique para editar concurso"
                >
                  {rangeText}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsEditing(true)}
                  className="cursor-pointer h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Editar concurso"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onSearch(game)}
                className="cursor-pointer"
                title="Pesquisar resultados"
              >
                <Search className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    title="Excluir jogo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir jogo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O jogo será removido
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(game.id)}
                      disabled={isDeleting}
                      className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {game.numeros.map((num) => (
              <span
                key={num}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: config.color }}
              >
                {num.toString().padStart(2, "0")}
              </span>
            ))}
          </div>

          {game.trevos && game.trevos.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Clover className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs text-muted-foreground mr-1">
                Trevos:
              </span>
              {game.trevos.map((trevo) => (
                <span
                  key={trevo}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold text-white bg-emerald-600"
                >
                  {trevo}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
