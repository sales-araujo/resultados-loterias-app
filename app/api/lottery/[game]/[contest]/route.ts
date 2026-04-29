import { NextRequest, NextResponse } from "next/server";
import https from "https";

const CAIXA_API_BASE =
  "https://servicebus3.caixa.gov.br/portaldeloterias/api";

export const dynamic = "force-dynamic";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchCaixa(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9",
          "Accept-Encoding": "identity",
          Connection: "keep-alive",
          Referer: "https://loterias.caixa.gov.br/",
          Origin: "https://loterias.caixa.gov.br",
        },
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode || 0, body: data })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function fetchWithRetry(
  url: string,
  game: string,
  contest: string
): Promise<{ data: Record<string, unknown> | null; notFound: boolean; error: string | null }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[Lottery API] Retry ${attempt}/${MAX_RETRIES} for ${game}/${contest} after ${delay}ms`);
      await sleep(delay);
    }

    try {
      const { statusCode, body } = await fetchCaixa(url);

      if (!body || body.trim() === "") {
        return { data: null, notFound: true, error: null };
      }

      if (statusCode === 404) {
        return { data: null, notFound: true, error: null };
      }

      // Caixa returns 500 when contest doesn't exist yet — treat as not found, no retry
      if (statusCode === 500) {
        return { data: null, notFound: true, error: null };
      }

      // HTML response = rate limiting / blocking — retry
      if (body.trimStart().startsWith("<!") || body.trimStart().startsWith("<html")) {
        console.warn(
          `[Lottery API] HTML response (status ${statusCode}) for ${game}/${contest}, attempt ${attempt + 1}/${MAX_RETRIES}`
        );
        continue;
      }

      // 403/503 = transient blocking — retry
      if (statusCode === 403 || statusCode === 503) {
        console.warn(`[Lottery API] Status ${statusCode} for ${game}/${contest}, attempt ${attempt + 1}`);
        continue;
      }

      // Other 4xx = not found / client error — no retry
      if (statusCode >= 400) {
        return { data: null, notFound: true, error: null };
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        console.warn(
          `[Lottery API] Invalid JSON for ${game}/${contest}, attempt ${attempt + 1}:`,
          body.substring(0, 100)
        );
        continue;
      }

      if (parsed?.exceptionMessage || parsed?.message === "Ocorreu um erro inesperado.") {
        return { data: null, notFound: true, error: null };
      }

      return { data: parsed, notFound: false, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Timeout") && attempt < MAX_RETRIES - 1) {
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

  const { data, notFound, error } = await fetchWithRetry(url, game, contest);

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
    const status = error.includes("Timeout") ? 504 : 502;
    return NextResponse.json(
      {
        error: true,
        message: error.includes("Timeout")
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
