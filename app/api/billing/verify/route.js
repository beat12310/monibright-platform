import { NextResponse } from "next/server";
import { pool } from "../../../../lib/db";
import { PLANS } from "../../../../lib/billing";

// Paystack redirects here after payment: /api/billing/verify?reference=xxx
export async function GET(req) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const origin = url.origin;
  if (!reference) return NextResponse.redirect(`${origin}/dashboard?billing=failed`);

  const key = process.env.PLATFORM_PAYSTACK_SECRET;
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  const tx = data?.data;
  if (!data.status || tx?.status !== "success") {
    return NextResponse.redirect(`${origin}/dashboard?billing=failed`);
  }

  const tenantId = tx.metadata?.tenant_id;
  const plan = tx.metadata?.plan;
  const p = PLANS[plan];
  // Amount check: paid at least the plan price (in pesewas)
  if (!tenantId || !p || tx.amount < p.price_ghs * 100 || tx.currency !== "GHS") {
    return NextResponse.redirect(`${origin}/dashboard?billing=failed`);
  }

  // Extend 30 days from whichever is later: now or current paid_until
  await pool.query(
    `UPDATE tenants SET plan=$2,
       paid_until = GREATEST(COALESCE(paid_until, NOW()), NOW()) + INTERVAL '30 days'
     WHERE id=$1`,
    [tenantId, plan]
  );
  return NextResponse.redirect(`${origin}/dashboard?billing=success`);
}
