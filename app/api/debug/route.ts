import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAIXA_URL =
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/3665";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  };

  // Test 1: allorigins proxy
  try {
    const url1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(CAIXA_URL)}`;
    const r1 = await fetch(url1, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const text1 = await r1.text();
    results.test1_allorigins = {
      status: r1.status,
      bodyLength: text1.length,
      bodyPreview: text1.substring(0, 200),
      isJSON: text1.trimStart().startsWith("{"),
    };
  } catch (err: unknown) {
    results.test1_allorigins = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 2: codetabs proxy
  try {
    const url2 = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(CAIXA_URL)}`;
    const r2 = await fetch(url2, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const text2 = await r2.text();
    results.test2_codetabs = {
      status: r2.status,
      bodyLength: text2.length,
      bodyPreview: text2.substring(0, 200),
      isJSON: text2.trimStart().startsWith("{"),
    };
  } catch (err: unknown) {
    results.test2_codetabs = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 3: direct fetch (expected to fail with 403 on Vercel)
  try {
    const r3 = await fetch(CAIXA_URL, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const text3 = await r3.text();
    results.test3_direct = {
      status: r3.status,
      bodyLength: text3.length,
      isJSON: text3.trimStart().startsWith("{"),
    };
  } catch (err: unknown) {
    results.test3_direct = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results);
}
