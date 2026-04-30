import { NextResponse } from "next/server";
import https from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function httpsGet(
  hostname: string,
  path: string
): Promise<{ statusCode: number; body: string; error: string | null }> {
  return new Promise((resolve) => {
    try {
      const req = https.get(
        {
          hostname,
          port: 443,
          path,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          rejectUnauthorized: false,
          timeout: 10000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () =>
            resolve({ statusCode: res.statusCode ?? 0, body: data, error: null })
          );
        }
      );
      req.on("error", (err) =>
        resolve({ statusCode: 0, body: "", error: `req error: ${err.message}` })
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ statusCode: 0, body: "", error: "timeout" });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ statusCode: 0, body: "", error: `catch: ${msg}` });
    }
  });
}

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    env_NODE_TLS: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? "not set",
  };

  // Test 1: simple response (no external call)
  results.test1_simple = "OK";

  // Test 2: https to servicebus2
  try {
    const r2 = await httpsGet(
      "servicebus2.caixa.gov.br",
      "/portaldeloterias/api/lotofacil/3665"
    );
    results.test2_servicebus2 = {
      statusCode: r2.statusCode,
      bodyLength: r2.body.length,
      bodyPreview: r2.body.substring(0, 150),
      error: r2.error,
    };
  } catch (err: unknown) {
    results.test2_servicebus2 = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 3: https to servicebus3
  try {
    const r3 = await httpsGet(
      "servicebus3.caixa.gov.br",
      "/portaldeloterias/api/lotofacil/3665"
    );
    results.test3_servicebus3 = {
      statusCode: r3.statusCode,
      bodyLength: r3.body.length,
      bodyPreview: r3.body.substring(0, 150),
      error: r3.error,
    };
  } catch (err: unknown) {
    results.test3_servicebus3 = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 4: native fetch to a public API (to rule out general network issues)
  try {
    const r4 = await fetch("https://httpbin.org/get", { signal: AbortSignal.timeout(5000) });
    results.test4_httpbin = {
      statusCode: r4.status,
      ok: r4.ok,
    };
  } catch (err: unknown) {
    results.test4_httpbin = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results);
}
