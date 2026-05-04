"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchLotteryResult } from "@/lib/lottery-api";
import { getCachedResult } from "@/lib/persistent-cache";
import { LotteryResult } from "@/lib/types";

export function useLotteryResult(game: string, contest: number | null) {
  const queryClient = useQueryClient();

  // Pre-populate React Query cache from IndexedDB on mount
  useEffect(() => {
    if (!game || !contest) return;

    // Check if React Query already has data
    const existing = queryClient.getQueryData<LotteryResult>([
      "lottery-result",
      game,
      contest,
    ]);
    if (existing) return;

    // Try to load from IndexedDB
    getCachedResult(game, contest).then((cached) => {
      if (cached) {
        queryClient.setQueryData(
          ["lottery-result", game, contest],
          cached
        );
      }
    });
  }, [game, contest, queryClient]);

  return useQuery<LotteryResult, Error>({
    queryKey: ["lottery-result", game, contest],
    queryFn: async () => {
      if (!contest) throw new Error("Concurso não informado");
      return fetchLotteryResult(game, contest);
    },
    enabled: !!game && !!contest,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: Infinity, // Never garbage collect — results are immutable
  });
}
