import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextMonthlyOccurrence(dayOfMonth) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth || 1);
  return next.toISOString().split("T")[0];
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = new Date().toISOString().split("T")[0];

  // Find all active templates due today or overdue
  const { data: templates, error: fetchError } = await supabase
    .from("expense_templates")
    .select("*")
    .eq("is_active", true)
    .lte("next_occurrence", today);

  if (fetchError) {
    console.error("Failed to fetch templates:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const results = [];

  for (const template of templates || []) {
    try {
      // Build the expense payload — try title first, fall back to name/description
      const basePayload = {
        group_id: template.group_id,
        paid_by: template.paid_by,
        participants: template.participants,
        split_type: template.split_type || "equal",
        split_method: template.split_method || "even",
        shares: template.shares || null,
        split_details: template.split_details || null,
        amount_cents: template.amount_cents || 0,
        created_at: new Date().toISOString(),
      };

      // Try inserting with title variants (mirrors createExpenseRecord fallback pattern)
      let expenseError = null;
      for (const titleKey of ["title", "name", "description"]) {
        const { error } = await supabase
          .from("expenses")
          .insert({ ...basePayload, [titleKey]: template.title });
        if (!error) {
          expenseError = null;
          break;
        }
        expenseError = error;
      }

      if (expenseError) throw expenseError;

      // Advance next_occurrence to next month
      const nextOccurrence = nextMonthlyOccurrence(template.day_of_month || 1);
      await supabase
        .from("expense_templates")
        .update({ next_occurrence: nextOccurrence })
        .eq("id", template.id);

      results.push({ id: template.id, title: template.title, status: "created" });
    } catch (err) {
      console.error(`Failed to create expense from template ${template.id}:`, err);
      results.push({ id: template.id, title: template.title, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
