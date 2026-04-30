import { NextRequest, NextResponse } from "next/server";
import https from "node:https";

// Force Node.js runtime (NOT edge) — required for https module with rejectUnauthorized
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CAIXA_HOSTS = [
  { hostname: "servicebus2.caixa.gov.br", path: "/portaldeloterias/api" },
  { hostname: "servicebus3.caixa.gov.br", path: "/portaldeloterias/api" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 60 * 1000;

type CacheResult = {
  data: Record<string, unknown> | null;
  notFound: boolean;
  error: string | null;
};

const cache = new Map<string, { result: CacheResult; timestamp: number }>();
const inFlight = new Map<string, Promise<CacheResult>>();

function httpsGet(
  hostname: string,
  path: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname,
        port: 443,
        path,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9",
          Referer: "https://loterias.caixa.gov.br/",
          Origin: "https://loterias.caixa.gov.br",
        },
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, body: data })
        );
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout (15s)"));
    });
  });
}

async function fetchFromCaixa(
  game: string,
  contest: string
): Promise<CacheResult> {
  const cacheKey = `${game}/${contest}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    const ttl = cached.result.notFound ? NOT_FOUND_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - cached.timestamp < ttl) return cached.result;
    cache.delete(cacheKey);
  }

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

  for (const host of CAIXA_HOSTS) {
    const fullPath = `${host.path}/${game}/${contest}`;

    try {
      console.log(
        `[Lottery API] Trying ${host.hostname}${fullPath}`
      );
      const { statusCode, body } = await httpsGet(host.hostname, fullPath);

      console.log(
        `[Lottery API] ${host.hostname} responded ${statusCode}, body length=${body.length}`
      );

      if (statusCode === 500 || statusCode === 404) {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      if (statusCode === 403 || statusCode === 503) {
        console.warn(
          `[Lottery API] ${host.hostname} status ${statusCode} for ${game}/${contest}`
        );
        errors.push(`${host.hostname}: HTTP ${statusCode}`);
        continue;
      }

      if (!body || body.trim() === "") {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      if (
        body.trimStart().startsWith("<!") ||
        body.trimStart().startsWith("<html")
      ) {
        console.warn(
          `[Lottery API] HTML response from ${host.hostname} for ${game}/${contest}`
        );
        errors.push(`${host.hostname}: HTML response (rate limit)`);
        continue;
      }

      if (statusCode >= 400) {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        console.warn(
          `[Lottery API] Invalid JSON from ${host.hostname} for ${game}/${contest}`
        );
        errors.push(`${host.hostname}: invalid JSON`);
        continue;
      }

      if (
        parsed?.exceptionMessage ||
        parsed?.message === "Ocorreu um erro inesperado."
      ) {
        const result: CacheResult = { data: null, notFound: true, error: null };
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      const result: CacheResult = {
        data: parsed,
        notFound: false,
        error: null,
      };
      cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Lottery API] ${host.hostname} error for ${game}/${contest}: ${msg}`
      );
      errors.push(`${host.hostname}: ${msg}`);
      continue;
    }
  }

  return {
    data: null,
    notFound: false,
    error: `Todos os servidores da Caixa falharam: ${errors.join("; ")}`,
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
