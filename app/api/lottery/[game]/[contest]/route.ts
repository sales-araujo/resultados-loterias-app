import { NextRequest, NextResponse } from "next/server";
import { Agent, request as undiciRequest } from "undici";

const CAIXA_API_BASE =
  "https://servicebus3.caixa.gov.br/portaldeloterias/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NOT_FOUND_CACHE_TTL_MS = 60 * 1000; // 1 minute for not-found

type CacheResult = { data: Record<string, unknown> | null; notFound: boolean; error: string | null };

// In-memory cache to avoid duplicate requests to Caixa
const cache = new Map<string, { result: CacheResult; timestamp: number }>();

// Deduplication: if a request is already in-flight, reuse the same promise
const inFlight = new Map<string, Promise<CacheResult>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCaixaSingle(url: string): Promise<{ statusCode: number; text: string }> {
  const { statusCode, body } = await undiciRequest(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
      Referer: "https://loterias.caixa.gov.br/",
      Origin: "https://loterias.caixa.gov.br",
    },
    dispatcher: insecureAgent,
    headersTimeout: 15000,
    bodyTimeout: 15000,
  });
  const text = await body.text();
  return { statusCode, text };
}

async function fetchCaixaWithRetry(
  url: string,
  game: string,
  contest: string
): Promise<CacheResult> {
  const cacheKey = `${game}/${contest}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const ttl = cached.result.notFound ? NOT_FOUND_CACHE_TTL_MS : CACHE_TTL_MS;
    if (age < ttl) {
      return cached.result;
    }
    cache.delete(cacheKey);
  }

  // Deduplicate: if already fetching this exact key, wait for the same result
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = doFetch(url, game, contest, cacheKey);
  inFlight.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function doFetch(
  url: string,
  game: string,
  contest: string,
  cacheKey: string
): Promise<CacheResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Lottery API] Retry ${attempt}/${MAX_RETRIES} for ${game}/${contest}`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const { statusCode, text } = await fetchCaixaSingle(url);

      // Caixa returns 500 when contest doesn't exist yet
      if (statusCode === 500 || statusCode === 404) {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Transient blocking — retry
      if (statusCode === 403 || statusCode === 503) {
        console.warn(`[Lottery API] Status ${statusCode} for ${game}/${contest}, attempt ${attempt + 1}`);
        continue;
      }

      if (!text || text.trim() === "") {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // HTML response = rate limiting — retry
      if (text.trimStart().startsWith("<!") || text.trimStart().startsWith("<html")) {
        console.warn(`[Lottery API] HTML response for ${game}/${contest}, attempt ${attempt + 1}/${MAX_RETRIES}`);
        continue;
      }

      // Other 4xx
      if (statusCode >= 400) {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.warn(`[Lottery API] Invalid JSON for ${game}/${contest}, attempt ${attempt + 1}`);
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
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[Lottery API] Error for ${game}/${contest}, attempt ${attempt + 1}: ${msg}`);
        continue;
      }
      return { data: null, notFound: false, error: msg };
    }
  }

  return {
    data: null,
    notFound: false,
    error: `API da Caixa indisponível após ${MAX_RETRIES} tentativas`,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string; contest: string }> }
) {
  const { game, contest } = await params;
  const url = `${CAIXA_API_BASE}/${game}/${contest}`;

  const { data, notFound, error } = await fetchCaixaWithRetry(url, game, contest);

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
