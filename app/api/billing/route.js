import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";
import { getBillingStatus, PLANS } from "../../../lib/billing";

export async function GET(req) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    const status = await getBillingStatus(tenantId);
    return NextResponse.json({ status, plans: PLANS });
  } catch (e) {
    console.error("GET /api/billing error:", e.message);
    return NextResponse.json({ error: "Could not load billing status." }, { status: 500 });
  }
}

// POST { plan: "basic" | "pro" } -> returns Paystack payment link
export async function POST(req) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    const { plan } = await req.json();
    const p = PLANS[plan];
    if (!p) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

    const key = process.env.PLATFORM_PAYSTACK_SECRET;
    if (!key) return NextResponse.json({ error: "Billing is not configured yet. Contact support." }, { status: 500 });

    const t = await pool.query(`SELECT email FROM tenants WHERE id=$1`, [tenantId]);
    const email = t.rows[0].email;
    const origin = new URL(req.url).origin;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: p.price_ghs * 100,
        currency: "GHS",
        callback_url: `${origin}/api/billing/verify`,
        metadata: { tenant_id: tenantId, plan }
      })
    });
    const data = await res.json();
    if (!data.status) return NextResponse.json({ error: "Could not start payment. Try again." }, { status: 500 });
    return NextResponse.json({ url: data.data.authorization_url });
  } catch (e) {
    console.error("POST /api/billing error:", e.message);
    return NextResponse.json({ error: "Could not start payment. Try again." }, { status: 500 });
  }
}
