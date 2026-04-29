export interface LotteryConfig {
  id: string;
  name: string;
  displayName: string;
  apiEndpoint: string;
  color: string;
  colorLight: string;
  numberRange: { min: number; max: number };
  drawCount: number;
  betMin: number;
  betMax: number;
  minMatchForPrize: number;
  hasSecondDraw?: boolean;
  hasTrevos?: boolean;
  trevoRange?: { min: number; max: number };
  trevoDrawCount?: number;
  trevoBetMin?: number;
  trevoBetMax?: number;
  isColumnBased?: boolean;
  columns?: number;
  numbersPerColumn?: number;
  fixedBet?: boolean;
  zeroBased?: boolean;
}

export interface Game {
  id: string;
  tipo_jogo: string;
  numeros: number[];
  trevos: number[] | null;
  concurso_inicio: number;
  concurso_fim: number | null;
  created_at: string;
  updated_at: string;
}

export interface GameInsert {
  tipo_jogo: string;
  numeros: number[];
  trevos?: number[] | null;
  concurso_inicio: number;
  concurso_fim?: number | null;
}

export interface LotteryPrize {
  descricaoFaixa: string;
  faixa: number;
  numeroDeGanhadores: number;
  valorPremio: number;
}

export interface LotteryWinner {
  ganhadores: number;
  municipio: string;
  nomeFatansiaUL: string;
  posicao: number;
  serie: string;
  uf: string;
}

export interface LotteryResult {
  acumulado: boolean;
  dataApuracao: string;
  dataProximoConcurso: string;
  dezenasSorteadasOrdemSorteio: string[];
  listaDezenas: string[];
  listaDezenasSegundoSorteio: string[] | null;
  listaMunicipioUFGanhadores: LotteryWinner[];
  listaRateioPremio: LotteryPrize[];
  listaResultadoEquipeEsportiva: unknown;
  localSorteio: string;
  nomeMunicipioUFSorteio: string;
  nomeTimeCoracaoMesSorte: string;
  numero: number;
  numeroConcursoAnterior: number;
  numeroConcursoProximo: number;
  tipoJogo: string;
  valorArrecadado: number;
  valorAcumuladoConcurso_0_5: number;
  valorAcumuladoConcursoEspecial: number;
  valorAcumuladoProximoConcurso: number;
  valorEstimadoProximoConcurso: number;
  valorSaldoReservaGarantidora: number;
  numeroConcursoFinal_0_5: number;
  indicadorConcursoEspecial: number;
  ultimoConcurso: boolean;
  // +Milionária specific
  listaTrevosSorteados?: string[];
}

export interface MatchResult {
  game: Game;
  result: LotteryResult;
  matchedNumbers: number[];
  matchedTrevos: number[];
  matchCount: number;
  trevoMatchCount: number;
  prizeInfo: LotteryPrize | null;
  isWinner: boolean;
}

export interface ConcursoStatus {
  loading: boolean;
  error: string | null;
  notFound: boolean;
  result: LotteryResult | null;
}
