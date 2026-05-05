"use client";

import { useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameCard } from "@/components/lottery/GameCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Game, LotteryConfig } from "@/lib/types";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";

interface GameSectionProps {
  title: string;
  count: number;
  games: Game[];
  config: LotteryConfig;
  variant: "active" | "ended";
  onDelete: (id: string) => void;
  onSearch: (game: Game) => void;
  onUpdateContest: (id: string, inicio: number, fim: number | null) => void;
  isDeleting?: boolean;
}

export function GameSection({
  title,
  count,
  games,
  config,
  variant,
  onDelete,
  onSearch,
  onUpdateContest,
  isDeleting,
}: GameSectionProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleCarouselPrev = useCallback(() => {
    setCarouselIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleCarouselNext = useCallback(() => {
    setCarouselIndex((prev) => Math.min(games.length - 1, prev + 1));
  }, [games.length]);

  const handleDelete = useCallback(
    (id: string) => {
      onDelete(id);
      setCarouselIndex((prev) => Math.max(0, Math.min(prev, games.length - 2)));
    },
    [onDelete, games.length]
  );

  // Keep carousel index in bounds when games change
  const safeIndex = Math.min(carouselIndex, Math.max(0, games.length - 1));

  // For ended variant with no games, parent handles visibility
  if (variant === "ended" && games.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: variant === "active" ? config.color : "#9ca3af" }}
        />
        <h3 className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <Badge
          variant="secondary"
          className="text-xs tabular-nums"
          style={
            variant === "active"
              ? {
                  backgroundColor: `${config.color}15`,
                  color: config.color,
                  borderColor: `${config.color}30`,
                }
              : undefined
          }
        >
          {count}
        </Badge>
      </div>

      {/* Empty state — active variant only */}
      {games.length === 0 && variant === "active" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-10 text-muted-foreground text-sm rounded-2xl border border-dashed border-border/60"
        >
          <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum jogo ativo</p>
          <p className="text-xs mt-1 text-muted-foreground/70">
            Clique em &quot;Novo Jogo&quot; para começar
          </p>
        </motion.div>
      )}

      {/* Game Cards Carousel */}
      {games.length > 0 && (
        <div className="relative">
          {/* Carousel arrows */}
          {games.length > 1 && (
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCarouselPrev}
                disabled={safeIndex === 0}
                className="cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                {safeIndex + 1} / {games.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCarouselNext}
                disabled={safeIndex >= games.length - 1}
                className="cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="overflow-hidden" ref={carouselRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={safeIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
              >
                {games[safeIndex] && (
                  <div
                    className={
                      variant === "ended"
                        ? "opacity-50 grayscale"
                        : undefined
                    }
                  >
                    <GameCard
                      game={games[safeIndex]}
                      config={config}
                      onDelete={handleDelete}
                      onSearch={onSearch}
                      onUpdateContest={onUpdateContest}
                      isDeleting={isDeleting}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots indicator */}
          {games.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {games.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`cursor-pointer w-2 h-2 rounded-full transition-all duration-200 ${
                    idx === safeIndex ? "w-6" : "bg-muted-foreground/20"
                  }`}
                  style={
                    idx === safeIndex
                      ? { backgroundColor: config.color }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
