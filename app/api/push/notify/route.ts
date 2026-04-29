import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { Agent, request as undiciRequest } from "undici";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const CAIXA_API_BASE =
  "https://servicebus3.caixa.gov.br/portaldeloterias/api";

const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

const LOTTERY_NAMES: Record<string, string> = {
  lotofacil: "Lotofácil",
  megasena: "Mega-Sena",
  quina: "Quina",
  lotomania: "Lotomania",
  timemania: "Timemania",
  duplasena: "Dupla Sena",
  diadesorte: "Dia de Sorte",
  supersete: "Super Sete",
  maismilionaria: "+Milionária",
};

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:loterias@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function fetchCaixa(url: string): Promise<string> {
  const { body } = await undiciRequest(url, {
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
  return await body.text();
}

interface LotteryResult {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  listaRateioPremio: Array<{
    descricaoFaixa: string;
    faixa: number;
    numeroDeGanhadores: number;
    valorPremio: number;
  }>;
  acumulado: boolean;
  valorEstimadoProximoConcurso: number;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  tipo_jogo: string[];
  last_notified_contest: Record<string, number> | null;
}

interface GameRow {
  tipo_jogo: string;
}

async function getLatestResult(game: string): Promise<LotteryResult | null> {
  try {
    const text = await fetchCaixa(`${CAIXA_API_BASE}/${game}/latest`);
    if (!text || text.trim() === "") return null;
    const data = JSON.parse(text);
    if (data?.exceptionMessage) return null;
    return data as LotteryResult;
  } catch {
    return null;
  }
}

function isRecentResult(dataApuracao: string): boolean {
  const [day, month, year] = dataApuracao.split("/");
  const resultDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const now = new Date();
  const diffMs = now.getTime() - resultDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 36;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { sent: number; failed: number; skipped: number; error?: string }> = {};

  try {
    // 1. Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("active", true);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        message: "No active subscriptions",
        error: subError?.message,
      });
    }

    // 2. Get all game types that have actual games created in the DB
    const { data: gamesInDb } = await supabaseAdmin
      .from("games")
      .select("tipo_jogo");

    const gameTypesWithGames = new Set<string>(
      (gamesInDb as GameRow[] || []).map((g) => g.tipo_jogo)
    );

    // 3. Build list of game types to check: intersection of subscribed + has games
    const gameTypesToCheck = new Set<string>();
    for (const sub of subscriptions as PushSubscriptionRow[]) {
      if (sub.tipo_jogo && sub.tipo_jogo.length > 0) {
        sub.tipo_jogo
          .filter((g) => gameTypesWithGames.has(g))
          .forEach((g) => gameTypesToCheck.add(g));
      }
    }

    if (gameTypesToCheck.size === 0) {
      return NextResponse.json({
        message: "No game types with both subscriptions and created games",
      });
    }

    // 4. For each game type, check latest result
    for (const gameType of gameTypesToCheck) {
      const result = await getLatestResult(gameType);
      if (!result) {
        results[gameType] = { sent: 0, failed: 0, skipped: 0, error: "Could not fetch result" };
        continue;
      }

      // Accept results from last 36 hours (covers overnight/next-day scenarios)
      if (!isRecentResult(result.dataApuracao)) {
        results[gameType] = { sent: 0, failed: 0, skipped: 0, error: "No recent result" };
        continue;
      }

      const gameName = LOTTERY_NAMES[gameType] || gameType;
      const numbers = (result.listaDezenas || []).join(", ");
      const acumulouText = result.acumulado
        ? `\n💰 ACUMULOU! Próximo: ${formatCurrency(result.valorEstimadoProximoConcurso)}`
        : "";

      const payload = JSON.stringify({
        title: `🍀 ${gameName} - Concurso ${result.numero}`,
        body: `Números: ${numbers}${acumulouText}\nConfira se você ganhou!`,
        icon: "/icons/icon-192x192.png",
        tag: `${gameType}-${result.numero}`,
        url: `/?game=${gameType}&contest=${result.numero}`,
        gameType,
        concurso: result.numero,
      });

      // 5. Filter subscribers: must have this game type AND not already notified for this contest
      const relevantSubs = (subscriptions as PushSubscriptionRow[]).filter((sub) => {
        if (!sub.tipo_jogo.includes(gameType)) return false;
        const lastNotified = sub.last_notified_contest || {};
        if (lastNotified[gameType] === result.numero) return false;
        return true;
      });

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      // 6. Check if each subscriber actually has games for this lottery type
      for (const sub of relevantSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth,
              },
            },
            payload
          );
          sent++;

          // Mark this contest as notified for this subscriber
          const lastNotified = sub.last_notified_contest || {};
          lastNotified[gameType] = result.numero;
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_notified_contest: lastNotified })
            .eq("id", sub.id);
        } catch (err: unknown) {
          failed++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ active: false })
              .eq("id", sub.id);
          }
        }
      }

      const alreadyNotified =
        (subscriptions as PushSubscriptionRow[]).filter(
          (sub) =>
            sub.tipo_jogo.includes(gameType) &&
            (sub.last_notified_contest || {})[gameType] === result.numero
        ).length - sent;
      skipped = Math.max(0, alreadyNotified);

      results[gameType] = { sent, failed, skipped };
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Push Notify]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
