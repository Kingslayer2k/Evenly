import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:support@evenly.app", vapidPublic, vapidPrivate);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request) {
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ ok: false, error: "VAPID keys not configured" }, { status: 503 });
  }

  try {
    const { recipientUserIds, title, body, url } = await request.json();

    if (!recipientUserIds?.length) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .in("user_id", recipientUserIds);

    if (error) throw error;
    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

    const payload = JSON.stringify({ title, body, url: url || "/home" });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload),
      ),
    );

    // Clean up expired subscriptions (410 Gone)
    const expired = results
      .map((r, i) => (r.status === "rejected" && r.reason?.statusCode === 410 ? subs[i].endpoint : null))
      .filter(Boolean);

    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expired);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("push/notify POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
