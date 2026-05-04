import { LotteryResult } from "./types";
import {
  getCachedResult,
  setCachedResult,
  getMostRecentCachedContest,
} from "./persistent-cache";

const API_BASE = "/api/lottery";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Fetch a single lottery result.
 * First checks IndexedDB persistent cache, then falls back to API.
 * Successful results (200) are stored permanently in IndexedDB.
 * No automatic retry — the user can retry manually via the UI button.
 */
export async function fetchLotteryResult(
  game: string,
  contest: number
): Promise<LotteryResult> {
  // Check persistent cache first (results are immutable)
  const cached = await getCachedResult(game, contest);
  if (cached) {
    console.log(`[Client] Cache hit for ${game}/${contest}`);
    return cached;
  }

  const response = await fetch(`${API_BASE}/${game}/${contest}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 404) {
      throw new NotFoundError(
        data?.message || `Concurso ${contest} ainda não foi apurado.`
      );
    }

    throw new Error(
      data?.message || `Erro ao buscar resultado do concurso ${contest}.`
    );
  }

  const result: LotteryResult = await response.json();

  // Store in persistent cache — this result is immutable
  await setCachedResult(game, contest, result);

  return result;
}

/**
 * Find the most recent contest that has a cached result in IndexedDB.
 * Returns null if nothing is cached for this game/range.
 */
export async function findMostRecentCachedContest(
  game: string,
  startContest: number,
  endContest: number
): Promise<number | null> {
  const cachedMostRecent = await getMostRecentCachedContest(
    game,
    startContest,
    endContest
  );

  if (cachedMostRecent !== null) {
    console.log(
      `[Client] Most recent cached contest for ${game}: ${cachedMostRecent}`
    );
  }

  return cachedMostRecent;
}
