"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLotteryResult } from "@/lib/lottery-api";
import { LotteryResult } from "@/lib/types";

export function useLotteryResult(game: string, contest: number | null) {
  return useQuery<LotteryResult, Error>({
    queryKey: ["lottery-result", game, contest],
    queryFn: async () => {
      if (!contest) throw new Error("Concurso não informado");
      return fetchLotteryResult(game, contest);
    },
    enabled: !!game && !!contest,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

export function useLotteryResults(
  game: string,
  startContest: number | null,
  endContest: number | null
) {
  const contests: number[] = [];
  if (startContest) {
    const end = endContest ?? startContest;
    for (let i = startContest; i <= end; i++) {
      contests.push(i);
    }
  }

  const results = contests.map((contest) => ({
    contest,
    ...useLotteryResult(game, contest),
  }));

  return results;
}
