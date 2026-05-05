"use client";

import { useState, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LotterySelector } from "@/components/lottery/LotterySelector";
import { GameForm } from "@/components/lottery/GameForm";
import { GameSection } from "@/components/lottery/GameSection";
import { GameCardSkeleton } from "@/components/lottery/GameCardSkeleton";
import { ContestSearch } from "@/components/lottery/ContestSearch";
import { ResultCard } from "@/components/lottery/ResultCard";
import { PendingResult } from "@/components/lottery/PendingResult";
import { StatsPanel } from "@/components/lottery/StatsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useGames } from "@/hooks/useGames";
import { useLotteryResult } from "@/hooks/useLotteryResult";
import { getLotteryConfig } from "@/lib/lottery-config";
import { crossCheckNumbers, classifyGame } from "@/lib/lottery-utils";
import { Game, GameInsert, MatchResult } from "@/lib/types";
import { NotFoundError } from "@/lib/lottery-api";
import { getCachedResultsInRange } from "@/lib/persistent-cache";
import {
  Ticket,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

function HomeContent() {
  const [selectedLottery, setSelectedLottery] = useState("lotofacil");
  const [searchingGame, setSearchingGame] = useState<Game | null>(null);
  const [currentContest, setCurrentContest] = useState<number | null>(null);
  const [latestContestMap, setLatestContestMap] = useState<Record<string, number>>({});

  const config = getLotteryConfig(selectedLottery)!;
  const { games, isLoading, createGame, deleteGame, updateGame } =
    useGames(selectedLottery);

  const {
    data: resultData,
    isLoading: isLoadingResult,
    error: resultError,
    refetch: refetchResult,
  } = useLotteryResult(
    searchingGame?.tipo_jogo || selectedLottery,
    currentContest
  );

  // Update latestContestMap when a result is fetched successfully
  const latestContest = latestContestMap[selectedLottery];

  useMemo(() => {
    if (resultData && resultData.numero) {
      setLatestContestMap((prev) => {
        const current = prev[selectedLottery];
        if (!current || resultData.numero > current) {
          return { ...prev, [selectedLottery]: resultData.numero };
        }
        return prev;
      });
    }
  }, [resultData, selectedLottery]);

  // Classify games into active and ended
  const { activeGames, endedGames } = useMemo(() => {
    if (!latestContest) {
      return { activeGames: games, endedGames: [] as Game[] };
    }
    const active: Game[] = [];
    const ended: Game[] = [];
    for (const game of games) {
      if (classifyGame(game, latestContest) === "active") {
        active.push(game);
      } else {
        ended.push(game);
      }
    }
    return { activeGames: active, endedGames: ended };
  }, [games, latestContest]);

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
    },
    [deleteGame, searchingGame]
  );

  // Lupa: open at the most recent cached contest, or concurso_inicio if no cache
  const handleGameSearch = useCallback(async (game: Game) => {
    setSearchingGame(game);
    setAllMatchResults([]);

    const start = game.concurso_inicio;
    const end = game.concurso_fim || game.concurso_inicio;

    // Load all cached results from IndexedDB and build stats immediately
    const cachedResults = await getCachedResultsInRange(game.tipo_jogo, start, end);

    if (cachedResults.size > 0) {
      // Build match results from cache for the stats panel
      const cachedMatches: MatchResult[] = [];
      let maxContest = 0;

      for (const [contest, result] of cachedResults) {
        cachedMatches.push(crossCheckNumbers(game, result));
        if (contest > maxContest) maxContest = contest;
      }

      cachedMatches.sort((a, b) => a.result.numero - b.result.numero);
      setAllMatchResults(cachedMatches);

      // Go straight to the most recent cached contest (instant, no API call)
      setCurrentContest(maxContest);

      setLatestContestMap((prev) => {
        const current = prev[game.tipo_jogo];
        if (!current || maxContest > current) {
          return { ...prev, [game.tipo_jogo]: maxContest };
        }
        return prev;
      });
    } else {
      // No cache — start from the first contest, single request
      setCurrentContest(start);
    }
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
  }, []);

  const handleUpdateContest = useCallback(
    (id: string, inicio: number, fim: number | null) => {
      updateGame.mutate({ id, concurso_inicio: inicio, concurso_fim: fim });
    },
    [updateGame]
  );

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

  // Collect all match results for stats (populated as user navigates)
  const [allMatchResults, setAllMatchResults] = useState<MatchResult[]>([]);

  // Accumulate match results as the user navigates through contests
  useMemo(() => {
    if (!searchingGame || !resultData) return;
    const match = crossCheckNumbers(searchingGame, resultData);
    setAllMatchResults((prev) => {
      // Don't add duplicates
      if (prev.some((m) => m.result.numero === match.result.numero)) return prev;
      // Insert in ascending order
      const next = [...prev, match].sort(
        (a, b) => a.result.numero - b.result.numero
      );
      return next;
    });
  }, [searchingGame, resultData]);

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

            {/* Games Sections */}
            {isLoading ? (
              <div className="space-y-3">
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
              </div>
            ) : (
              <>
                <GameSection
                  title="Jogos Ativos"
                  count={activeGames.length}
                  games={activeGames}
                  config={config}
                  variant="active"
                  onDelete={handleDeleteGame}
                  onSearch={handleGameSearch}
                  onUpdateContest={handleUpdateContest}
                  isDeleting={deleteGame.isPending}
                />

                {endedGames.length > 0 && (
                  <GameSection
                    title="Jogos Encerrados"
                    count={endedGames.length}
                    games={endedGames}
                    config={config}
                    variant="ended"
                    onDelete={handleDeleteGame}
                    onSearch={handleGameSearch}
                    onUpdateContest={handleUpdateContest}
                    isDeleting={deleteGame.isPending}
                  />
                )}
              </>
            )}
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
                    <div className="text-center flex flex-col items-center gap-1">
                      <ContestSearch
                        currentContest={currentContest}
                        minContest={searchingGame.concurso_inicio}
                        maxContest={searchingGame.concurso_fim || searchingGame.concurso_inicio}
                        onSearch={setCurrentContest}
                        disabled={isLoadingResult}
                      />
                      {searchingGame.concurso_fim && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {searchingGame.concurso_inicio} - {searchingGame.concurso_fim}
                        </span>
                      )}
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

                  {/* Result content with animation on contest change */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentContest}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
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

                      {/* Not Found / Error */}
                      {!isLoadingResult && (isNotFound || (resultError && !resultData)) && (
                        <PendingResult
                          contestNumber={currentContest}
                          config={config}
                          isError={!!resultError && !isNotFound}
                          errorMessage={resultError?.message}
                          onRetry={() => refetchResult()}
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
                    </motion.div>
                  </AnimatePresence>

                  {/* Stats panel — shows as user accumulates results navigating */}
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
                  className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/50"
                >
                  <div
                    className="p-5 rounded-2xl mb-4"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <Ticket
                      className="h-14 w-14"
                      style={{ color: `${config.color}30` }}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground/70 mb-1">
                    Resultados
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Cadastre um jogo e clique em{" "}
                    <span className="font-semibold" style={{ color: config.color }}>
                      &quot;Buscar Resultado&quot;
                    </span>{" "}
                    para conferir seus acertos.
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
  return <HomeContent />;
}
