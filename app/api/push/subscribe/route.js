import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request) {
  try {
    const { subscription, userId } = await request.json();
    if (!subscription?.endpoint || !subscription?.keys || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { onConflict: "endpoint" },
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { endpoint, userId } = await request.json();
    if (!endpoint || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    }

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe DELETE:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
