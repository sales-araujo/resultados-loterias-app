import { LotteryResult } from "./types";

const API_BASE = "/api/lottery";

export async function fetchLotteryResult(
  game: string,
  contest: number
): Promise<LotteryResult> {
  const response = await fetch(`${API_BASE}/${game}/${contest}`);

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

  return response.json();
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function fetchLotteryResults(
  game: string,
  startContest: number,
  endContest: number | null
): Promise<Map<number, LotteryResult | null>> {
  const results = new Map<number, LotteryResult | null>();
  const end = endContest ?? startContest;

  const promises: Promise<void>[] = [];

  for (let i = startContest; i <= end; i++) {
    const contestNumber = i;
    promises.push(
      fetchLotteryResult(game, contestNumber)
        .then((result) => {
          results.set(contestNumber, result);
        })
        .catch(() => {
          results.set(contestNumber, null);
        })
    );
  }

  await Promise.all(promises);
  return results;
}
