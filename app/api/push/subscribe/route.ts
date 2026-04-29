import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, tipoJogo } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: "Subscription inválida" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, tipo_jogo")
      .eq("endpoint", subscription.endpoint)
      .single();

    if (existing) {
      const currentGames: string[] = existing.tipo_jogo || [];
      const newGames = tipoJogo
        ? Array.from(new Set([...currentGames, ...tipoJogo]))
        : currentGames;

      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .update({
          keys_p256dh: subscription.keys.p256dh,
          keys_auth: subscription.keys.auth,
          tipo_jogo: newGames,
          active: true,
        })
        .eq("id", existing.id);

      if (error) throw error;

      return NextResponse.json({ success: true, updated: true, games: newGames });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .insert({
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        tipo_jogo: tipoJogo || [],
        active: true,
      });

    if (error) throw error;

    return NextResponse.json({ success: true, created: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Push Subscribe]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false })
      .eq("endpoint", endpoint);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Push Unsubscribe]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
