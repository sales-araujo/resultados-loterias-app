"use client";

import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LotterySelector } from "@/components/lottery/LotterySelector";
import { GameForm } from "@/components/lottery/GameForm";
import { GameCard } from "@/components/lottery/GameCard";
import { ResultCard } from "@/components/lottery/ResultCard";
import { PendingResult } from "@/components/lottery/PendingResult";
import { StatsPanel } from "@/components/lottery/StatsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useGames } from "@/hooks/useGames";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLotteryResult } from "@/hooks/useLotteryResult";
import { getLotteryConfig, LOTTERY_CONFIGS } from "@/lib/lottery-config";
import { crossCheckNumbers, formatCurrency } from "@/lib/lottery-utils";
import { Game, GameInsert, MatchResult, LotteryResult } from "@/lib/types";
import { NotFoundError } from "@/lib/lottery-api";
import {
  Ticket,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  X,
  Bell,
  BellOff,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";

function HomeContent() {
  const searchParams = useSearchParams();
  const [selectedLottery, setSelectedLottery] = useState("lotofacil");
  const [searchingGame, setSearchingGame] = useState<Game | null>(null);
  const [currentContest, setCurrentContest] = useState<number | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const config = getLotteryConfig(selectedLottery)!;
  const { games, isLoading, createGame, deleteGame, updateGame } =
    useGames(selectedLottery);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { permission, isSubscribed, isLoading: isPushLoading, subscribe, unsubscribe } =
    usePushNotifications();

  // Deep link from push notification: ?game=lotofacil&contest=3669
  useEffect(() => {
    if (deepLinkHandled || isLoading) return;
    const gameParam = searchParams.get("game");
    const contestParam = searchParams.get("contest");
    if (gameParam && contestParam) {
      const contestNum = parseInt(contestParam, 10);
      if (contestNum > 0) {
        setSelectedLottery(gameParam);
        setCurrentContest(contestNum);
        // Find a matching game to show cross-check results
        const matchingGame = games.find(
          (g) =>
            g.tipo_jogo === gameParam &&
            g.concurso_inicio <= contestNum &&
            (g.concurso_fim ? g.concurso_fim >= contestNum : g.concurso_inicio === contestNum)
        );
        if (matchingGame) {
          setSearchingGame(matchingGame);
        } else if (games.length > 0) {
          // Use first game of this type as context
          const firstGame = games.find((g) => g.tipo_jogo === gameParam);
          if (firstGame) {
            setSearchingGame(firstGame);
          }
        }
        setDeepLinkHandled(true);
      }
    }
  }, [searchParams, games, isLoading, deepLinkHandled]);

  const {
    data: resultData,
    isLoading: isLoadingResult,
    error: resultError,
  } = useLotteryResult(
    searchingGame?.tipo_jogo || selectedLottery,
    currentContest
  );

  const matchResult: MatchResult | null = useMemo(() => {
    if (!searchingGame || !resultData) return null;
    return crossCheckNumbers(searchingGame, resultData);
  }, [searchingGame, resultData]);

  const handleCreateGame = useCallback(
    (game: GameInsert) => {
      createGame.mutate(game);
    },
    [createGame]
  );

  const handleDeleteGame = useCallback(
    (id: string) => {
      deleteGame.mutate(id);
      if (searchingGame?.id === id) {
        setSearchingGame(null);
        setCurrentContest(null);
      }
      setCarouselIndex((prev) => Math.max(0, Math.min(prev, games.length - 2)));
    },
    [deleteGame, searchingGame, games.length]
  );

  const handleSearchGame = useCallback((game: Game) => {
    setSearchingGame(game);
    setCurrentContest(game.concurso_inicio);
  }, []);

  const handlePrevContest = useCallback(() => {
    if (!searchingGame || !currentContest) return;
    if (currentContest > searchingGame.concurso_inicio) {
      setCurrentContest(currentContest - 1);
    }
  }, [searchingGame, currentContest]);

  const handleNextContest = useCallback(() => {
    if (!searchingGame || !currentContest) return;
    const endContest =
      searchingGame.concurso_fim || searchingGame.concurso_inicio;
    if (currentContest < endContest) {
      setCurrentContest(currentContest + 1);
    }
  }, [searchingGame, currentContest]);

  const handleCloseResults = useCallback(() => {
    setSearchingGame(null);
    setCurrentContest(null);
  }, []);

  const handleLotteryChange = useCallback((value: string) => {
    setSelectedLottery(value);
    setSearchingGame(null);
    setCurrentContest(null);
    setCarouselIndex(0);
  }, []);

  const handleUpdateContest = useCallback(
    (id: string, inicio: number, fim: number | null) => {
      updateGame.mutate({ id, concurso_inicio: inicio, concurso_fim: fim });
    },
    [updateGame]
  );

  const handleCarouselPrev = useCallback(() => {
    setCarouselIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleCarouselNext = useCallback(() => {
    setCarouselIndex((prev) => Math.min(games.length - 1, prev + 1));
  }, [games.length]);

  const canGoPrev =
    searchingGame &&
    currentContest &&
    currentContest > searchingGame.concurso_inicio;
  const canGoNext =
    searchingGame &&
    currentContest &&
    currentContest <
      (searchingGame.concurso_fim || searchingGame.concurso_inicio);

  const isNotFound =
    resultError instanceof NotFoundError ||
    (resultError && resultError.message?.includes("não foi apurado"));

  // Collect all match results for stats
  const [allMatchResults, setAllMatchResults] = useState<MatchResult[]>([]);

  const handleSearchAllContests = useCallback(
    async (game: Game) => {
      const gameConfig = getLotteryConfig(game.tipo_jogo);
      if (!gameConfig) return;

      setSearchingGame(game);
      setCurrentContest(game.concurso_inicio);

      const end = game.concurso_fim || game.concurso_inicio;
      const results: MatchResult[] = [];

      toast.info(
        `Buscando resultados dos concursos ${game.concurso_inicio} a ${end}...`
      );

      for (let i = game.concurso_inicio; i <= end; i++) {
        try {
          const res = await fetch(
            `/api/lottery/${game.tipo_jogo}/${i}`
          );
          if (res.ok) {
            const data: LotteryResult = await res.json();
            const match = crossCheckNumbers(game, data);
            results.push(match);
          }
        } catch {
          // skip failed contests
        }
      }

      setAllMatchResults(results);
      if (results.length > 0) {
        const wins = results.filter((r) => r.isWinner);
        const totalPrize = wins.reduce(
          (s, r) => s + (r.prizeInfo?.valorPremio || 0),
          0
        );
        if (wins.length > 0) {
          toast.success(
            `Você foi premiado em ${wins.length} concurso${
              wins.length > 1 ? "s" : ""
            }! Total: ${formatCurrency(totalPrize)}`
          );
        } else {
          toast.info(
            `Nenhum prêmio nos ${results.length} concurso${
              results.length > 1 ? "s" : ""
            } analisados.`
          );
        }
      }
    },
    []
  );

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Ticket className="h-5 w-5" style={{ color: config.color }} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">
                Loterias Caixa
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Meus Jogos &amp; Resultados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer relative"
              disabled={isPushLoading || permission === "unsupported"}
              onClick={() => {
                if (isSubscribed) {
                  unsubscribe();
                } else {
                  subscribe([selectedLottery]);
                }
              }}
              title={
                permission === "unsupported"
                  ? "Notificações não suportadas neste navegador"
                  : isSubscribed
                  ? "Desativar notificações"
                  : "Ativar notificações de resultados"
              }
            >
              {isPushLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <BellRing className="h-4 w-4" style={{ color: config.color }} />
              ) : permission === "denied" ? (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Bell className="h-4 w-4 text-muted-foreground" />
              )}
              {isSubscribed && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
              )}
            </Button>
            <Badge
              className="text-xs font-bold"
              style={{
                backgroundColor: `${config.color}20`,
                color: config.color,
                borderColor: `${config.color}40`,
              }}
            >
              {config.displayName}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-8">
        {/* Lottery Selector */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LotterySelector
            value={selectedLottery}
            onValueChange={handleLotteryChange}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column: Form + Games */}
          <div className="space-y-4">
            <GameForm
              config={config}
              onSubmit={handleCreateGame}
              isSubmitting={createGame.isPending}
            />

            {/* Games List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <ListChecks className="h-4 w-4" />
                  Meus Jogos ({games.length})
                </h3>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : games.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  <Ticket className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nenhum jogo cadastrado para {config.displayName}</p>
                  <p className="text-xs mt-1">
                    Cadastre seus números acima para começar
                  </p>
                </motion.div>
              ) : (
                <div className="relative">
                  {/* Carousel arrows */}
                  {games.length > 1 && (
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleCarouselPrev}
                        disabled={carouselIndex === 0}
                        className="cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {carouselIndex + 1} / {games.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleCarouselNext}
                        disabled={carouselIndex >= games.length - 1}
                        className="cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="overflow-hidden" ref={carouselRef}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={carouselIndex}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.2 }}
                      >
                        {games[carouselIndex] && (
                          <GameCard
                            game={games[carouselIndex]}
                            config={config}
                            onDelete={handleDeleteGame}
                            onSearch={(g) => {
                              if (
                                g.concurso_fim &&
                                g.concurso_fim > g.concurso_inicio
                              ) {
                                handleSearchAllContests(g);
                              } else {
                                handleSearchGame(g);
                              }
                            }}
                            onUpdateContest={handleUpdateContest}
                            isDeleting={deleteGame.isPending}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  {/* Dots indicator */}
                  {games.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-2">
                      {games.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCarouselIndex(idx)}
                          className={`cursor-pointer w-2 h-2 rounded-full transition-all ${idx === carouselIndex ? "w-5" : "bg-muted-foreground/30"}`}
                          style={idx === carouselIndex ? { backgroundColor: config.color } : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {searchingGame && currentContest ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Contest Navigation */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handlePrevContest}
                      disabled={!canGoPrev || isLoadingResult}
                      className="cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Navegando concursos
                      </p>
                      <p className="text-sm font-bold tabular-nums">
                        {currentContest}
                        {searchingGame.concurso_fim && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            / {searchingGame.concurso_inicio} -{" "}
                            {searchingGame.concurso_fim}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleNextContest}
                        disabled={!canGoNext || isLoadingResult}
                        className="cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleCloseResults}
                        className="cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Loading */}
                  {isLoadingResult && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <Loader2
                        className="h-8 w-8 animate-spin"
                        style={{ color: config.color }}
                      />
                      <p className="text-sm text-muted-foreground">
                        Buscando resultado do concurso {currentContest}...
                      </p>
                    </div>
                  )}

                  {/* Not Found */}
                  {!isLoadingResult && (isNotFound || (resultError && !resultData)) && (
                    <PendingResult
                      contestNumber={currentContest}
                      config={config}
                      isError={!!resultError && !isNotFound}
                      errorMessage={resultError?.message}
                    />
                  )}

                  {/* Result */}
                  {!isLoadingResult && resultData && (
                    <ResultCard
                      result={resultData}
                      config={config}
                      matchResult={matchResult}
                    />
                  )}

                  {/* Stats panel for range searches */}
                  {allMatchResults.length > 1 && (
                    <>
                      <Separator />
                      <StatsPanel
                        matchResults={allMatchResults}
                        config={config}
                      />
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div
                    className="p-4 rounded-2xl mb-4"
                    style={{ backgroundColor: `${config.color}10` }}
                  >
                    <Ticket
                      className="h-12 w-12"
                      style={{ color: `${config.color}40` }}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                    Resultados
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Cadastre um jogo e clique no botão de pesquisa para
                    verificar os resultados e conferir seus acertos.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        <p>Loterias Caixa - Meus Jogos &amp; Resultados</p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
