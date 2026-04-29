import { NextRequest, NextResponse } from "next/server";

const CAIXA_API_BASE =
  "https://servicebus3.caixa.gov.br/portaldeloterias/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Allow self-signed/expired certs from Caixa in Node.js runtime
if (typeof process !== "undefined") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCaixaWithRetry(
  url: string,
  game: string,
  contest: string
): Promise<{ data: Record<string, unknown> | null; notFound: boolean; error: string | null }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Lottery API] Retry ${attempt}/${MAX_RETRIES} for ${game}/${contest}`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
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

      // Caixa returns 500 when contest doesn't exist yet
      if (res.status === 500 || res.status === 404) {
        return { data: null, notFound: true, error: null };
      }

      // Transient blocking — retry
      if (res.status === 403 || res.status === 503) {
        console.warn(`[Lottery API] Status ${res.status} for ${game}/${contest}, attempt ${attempt + 1}`);
        continue;
      }

      const body = await res.text();

      if (!body || body.trim() === "") {
        return { data: null, notFound: true, error: null };
      }

      // HTML response = rate limiting — retry
      if (body.trimStart().startsWith("<!") || body.trimStart().startsWith("<html")) {
        console.warn(`[Lottery API] HTML response for ${game}/${contest}, attempt ${attempt + 1}/${MAX_RETRIES}`);
        continue;
      }

      // Other 4xx
      if (res.status >= 400) {
        return { data: null, notFound: true, error: null };
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        console.warn(`[Lottery API] Invalid JSON for ${game}/${contest}, attempt ${attempt + 1}`);
        continue;
      }

      if (parsed?.exceptionMessage || parsed?.message === "Ocorreu um erro inesperado.") {
        return { data: null, notFound: true, error: null };
      }

      return { data: parsed, notFound: false, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if ((msg.includes("abort") || msg.includes("Timeout")) && attempt < MAX_RETRIES - 1) {
        console.warn(`[Lottery API] Timeout for ${game}/${contest}, attempt ${attempt + 1}`);
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
    const status = error.includes("Timeout") || error.includes("abort") ? 504 : 502;
    return NextResponse.json(
      {
        error: true,
        message: status === 504
          ? "Tempo limite excedido ao conectar com a API da Caixa."
          : `Erro ao conectar com a API da Caixa: ${error}`,
      },
      { status }
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
