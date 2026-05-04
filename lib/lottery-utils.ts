import { Game, LotteryResult, MatchResult, LotteryPrize } from "./types";
import { getLotteryConfig } from "./lottery-config";

export function crossCheckNumbers(
  game: Game,
  result: LotteryResult
): MatchResult {
  const config = getLotteryConfig(game.tipo_jogo);

  const drawnNumbers = (result.listaDezenas || []).map((d) =>
    parseInt(d, 10)
  );

  const matchedNumbers = game.numeros.filter((n) => drawnNumbers.includes(n));

  let matchedTrevos: number[] = [];
  let trevoMatchCount = 0;

  if (config?.hasTrevos && game.trevos && result.listaTrevosSorteados) {
    const drawnTrevos = result.listaTrevosSorteados.map((t) =>
      parseInt(t, 10)
    );
    matchedTrevos = game.trevos.filter((t) => drawnTrevos.includes(t));
    trevoMatchCount = matchedTrevos.length;
  }

  const matchCount = matchedNumbers.length;

  const prizeInfo = findPrize(
    result.listaRateioPremio,
    matchCount,
    trevoMatchCount,
    config?.hasTrevos || false,
    game.tipo_jogo
  );

  const isWinner = prizeInfo !== null;

  return {
    game,
    result,
    matchedNumbers,
    matchedTrevos,
    matchCount,
    trevoMatchCount,
    prizeInfo,
    isWinner,
  };
}

function findPrize(
  prizes: LotteryPrize[],
  matchCount: number,
  trevoMatchCount: number,
  hasTrevos: boolean,
  tipoJogo: string
): LotteryPrize | null {
  if (!prizes || prizes.length === 0) return null;

  if (tipoJogo === "lotomania") {
    for (const prize of prizes) {
      const desc = prize.descricaoFaixa.toLowerCase();
      if (matchCount === 0 && desc.includes("0 acerto")) {
        return prize;
      }
      const acertosMatch = desc.match(/(\d+)\s*acerto/);
      if (acertosMatch && parseInt(acertosMatch[1], 10) === matchCount) {
        return prize;
      }
    }
    return null;
  }

  if (hasTrevos) {
    for (const prize of prizes) {
      const desc = prize.descricaoFaixa.toLowerCase();
      const numMatch = desc.match(/(\d+)/g);
      if (numMatch && numMatch.length >= 2) {
        const acertos = parseInt(numMatch[0], 10);
        const trevos = parseInt(numMatch[1], 10);
        if (acertos === matchCount && trevos === trevoMatchCount) {
          return prize;
        }
      }
    }
    return null;
  }

  for (const prize of prizes) {
    const desc = prize.descricaoFaixa.toLowerCase();
    const acertosMatch = desc.match(/(\d+)\s*acerto/);
    if (acertosMatch && parseInt(acertosMatch[1], 10) === matchCount) {
      return prize;
    }
  }

  return null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(num: number, zeroBased?: boolean): string {
  if (zeroBased) {
    return num.toString().padStart(2, "0");
  }
  return num.toString().padStart(2, "0");
}

export function getMatchLabel(count: number): string {
  if (count === 0) return "Nenhum acerto";
  if (count === 1) return "1 acerto";
  return `${count} acertos`;
}

export function getLatestContestForGame(game: Game): number {
  return game.concurso_fim ?? game.concurso_inicio;
}

export function classifyGame(
  game: Game,
  latestContest: number
): "active" | "ended" {
  return getLatestContestForGame(game) >= latestContest ? "active" : "ended";
}
