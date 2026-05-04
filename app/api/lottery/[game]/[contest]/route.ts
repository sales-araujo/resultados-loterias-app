import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Caixa blocks Vercel/AWS datacenter IPs (403).
// We use proxy services to route requests through non-blocked IPs.
const CAIXA_API = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

const PROXY_URLS = [
  // Proxy 1: AllOrigins (mais confiável)
  (url: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // Proxy 2: CORS Anywhere alternativo
  (url: string) =>
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  // Proxy 3: CodeTabs
  (url: string) =>
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  // Proxy 4: ThingProxy
  (url: string) =>
    `https://thingproxy.freeboard.io/fetch/${url}`,
  // Direct fetch as last resort (works locally, blocked on Vercel)
  (url: string) => url,
];

const NOT_FOUND_CACHE_TTL_MS = 60 * 1000; // 60 segundos para não encontrados
const ERROR_CACHE_TTL_MS = 30 * 1000; // 30 segundos para erros

type CacheResult = {
  data: Record<string, unknown> | null;
  notFound: boolean;
  error: string | null;
  timestamp?: number; // Adicionar timestamp para melhor controle
};

const cache = new Map<string, { result: CacheResult; timestamp: number }>();
const inFlight = new Map<string, Promise<CacheResult>>();

async function fetchFromCaixa(
  game: string,
  contest: string
): Promise<CacheResult> {
  const cacheKey = `${game}/${contest}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    // Valid results (data !== null) are cached permanently — lottery results are immutable
    if (cached.result.data !== null) {
      console.log(`[Lottery API] Cache hit (permanent) for ${cacheKey}`);
      return cached.result;
    }

    // Not-found and error results use TTL-based expiration
    const ttl = cached.result.notFound
      ? NOT_FOUND_CACHE_TTL_MS
      : ERROR_CACHE_TTL_MS;

    if (Date.now() - cached.timestamp < ttl) {
      console.log(`[Lottery API] Cache hit for ${cacheKey}`);
      return cached.result;
    }
    cache.delete(cacheKey);
  }

  const existing = inFlight.get(cacheKey);
  if (existing) {
    console.log(`[Lottery API] Request in-flight for ${cacheKey}`);
    return existing;
  }

  const promise = doFetch(game, contest, cacheKey);
  inFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function doFetch(
  game: string,
  contest: string,
  cacheKey: string
): Promise<CacheResult> {
  const caixaUrl = `${CAIXA_API}/${game}/${contest}`;
  const errors: string[] = [];

  for (let i = 0; i < PROXY_URLS.length; i++) {
    const proxyUrl = PROXY_URLS[i](caixaUrl);
    const label = i < PROXY_URLS.length - 1 ? `proxy${i + 1}` : "direct";

    try {
      console.log(`[Lottery API] Trying ${label} for ${game}/${contest}`);

      const controller = new AbortController();
      // Aumentar timeout para 20 segundos (melhor para PWA)
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(proxyUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      console.log(
        `[Lottery API] ${label} responded ${res.status} for ${game}/${contest}`
      );

      // Proxy returned an error for the upstream
      if (res.status === 404) {
        const result: CacheResult = {
          data: null,
          notFound: true,
          error: null,
          timestamp: Date.now(),
        };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      if (res.status === 403 || res.status === 500 || res.status === 503 || res.status === 520 || res.status === 522) {
        errors.push(`${label}: HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();

      if (!text || text.trim() === "") {
        const result: CacheResult = {
          data: null,
          notFound: true,
          error: null,
          timestamp: Date.now(),
        };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // HTML = blocked/rate-limited
      if (
        text.trimStart().startsWith("<!") ||
        text.trimStart().startsWith("<html")
      ) {
        errors.push(`${label}: HTML response`);
        continue;
      }

      if (res.status >= 400) {
        const result: CacheResult = {
          data: null,
          notFound: true,
          error: null,
          timestamp: Date.now(),
        };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        errors.push(`${label}: invalid JSON`);
        continue;
      }

      if (
        parsed?.exceptionMessage ||
        parsed?.message === "Ocorreu um erro inesperado."
      ) {
        const result: CacheResult = {
          data: null,
          notFound: true,
          error: null,
          timestamp: Date.now(),
        };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      const result: CacheResult = {
        data: parsed,
        notFound: false,
        error: null,
        timestamp: Date.now(),
      };
      cache.set(cacheKey, { result, timestamp: Date.now() });
      console.log(`[Lottery API] Success with ${label} for ${game}/${contest}`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Lottery API] ${label} error: ${msg}`);
      errors.push(`${label}: ${msg}`);
      continue;
    }
  }

  // Todos os proxies falharam - cachear o erro por menos tempo
  const errorResult: CacheResult = {
    data: null,
    notFound: false,
    error: `Todos os proxies falharam: ${errors.join("; ")}`,
    timestamp: Date.now(),
  };
  cache.set(cacheKey, { result: errorResult, timestamp: Date.now() });
  return errorResult;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string; contest: string }> }
) {
  const { game, contest } = await params;

  const { data, notFound, error } = await fetchFromCaixa(game, contest);

  if (notFound) {
    return NextResponse.json(
      {
        error: true,
        message: `Concurso ${contest} ainda não foi apurado ou não existe.`,
        notFound: true,
      },
      { status: 404 }
    );
  }

  if (error) {
    console.error(`[Lottery API] Failed ${game}/${contest}:`, error);
    return NextResponse.json(
      {
        error: true,
        message: `Erro ao conectar com a API da Caixa: ${error}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
