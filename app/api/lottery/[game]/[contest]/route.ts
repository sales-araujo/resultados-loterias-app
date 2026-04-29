import { NextRequest, NextResponse } from "next/server";

// Try servicebus2 first (valid SSL cert), then servicebus3 as fallback
const CAIXA_API_BASES = [
  "https://servicebus2.caixa.gov.br/portaldeloterias/api",
  "https://servicebus3.caixa.gov.br/portaldeloterias/api",
];

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_TTL_MS = 5 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 60 * 1000;

type CacheResult = { data: Record<string, unknown> | null; notFound: boolean; error: string | null };

const cache = new Map<string, { result: CacheResult; timestamp: number }>();
const inFlight = new Map<string, Promise<CacheResult>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFromCaixa(
  game: string,
  contest: string
): Promise<CacheResult> {
  const cacheKey = `${game}/${contest}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    const ttl = cached.result.notFound ? NOT_FOUND_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }
    cache.delete(cacheKey);
  }

  // Deduplicate in-flight requests
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

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
  const errors: string[] = [];

  // Try each API base URL
  for (const base of CAIXA_API_BASES) {
    const url = `${base}/${game}/${contest}`;

    // Up to 2 attempts per base URL
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await sleep(2000);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9",
            Referer: "https://loterias.caixa.gov.br/",
            Origin: "https://loterias.caixa.gov.br",
          },
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeoutId);

        if (res.status === 500 || res.status === 404) {
          const result: CacheResult = { data: null, notFound: true, error: null };
          cache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }

        if (res.status === 403 || res.status === 503) {
          console.warn(`[Lottery API] ${base} status ${res.status} for ${game}/${contest}`);
          continue;
        }

        const text = await res.text();

        if (!text || text.trim() === "") {
          const result: CacheResult = { data: null, notFound: true, error: null };
          cache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }

        if (text.trimStart().startsWith("<!") || text.trimStart().startsWith("<html")) {
          console.warn(`[Lottery API] HTML from ${base} for ${game}/${contest}, attempt ${attempt + 1}`);
          continue;
        }

        if (res.status >= 400) {
          const result: CacheResult = { data: null, notFound: true, error: null };
          cache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          console.warn(`[Lottery API] Invalid JSON from ${base} for ${game}/${contest}`);
          continue;
        }

        if (parsed?.exceptionMessage || parsed?.message === "Ocorreu um erro inesperado.") {
          const result: CacheResult = { data: null, notFound: true, error: null };
          cache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }

        const result: CacheResult = { data: parsed, notFound: false, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.warn(`[Lottery API] ${base} error for ${game}/${contest}: ${msg}`);
        errors.push(`${base}: ${msg}`);
        // If SSL/network error, don't retry this base — move to next
        break;
      }
    }
  }

  return {
    data: null,
    notFound: false,
    error: `API da Caixa indisponível. Erros: ${errors.join("; ")}`,
  };
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
