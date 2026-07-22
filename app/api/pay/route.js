import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";

export async function POST(req) {
  try {
    const { tenantId, gb } = await req.json();
    const tenantRes = await pool.query(`SELECT paystack_secret_key, business_name FROM tenants WHERE id=$1`, [tenantId]);
    if (tenantRes.rows.length === 0) return NextResponse.json({ error: "Unknown business." }, { status: 404 });
    const { paystack_secret_key, business_name } = tenantRes.rows[0];
    if (!paystack_secret_key) return NextResponse.json({ error: "This business hasn't connected Paystack yet." }, { status: 400 });

    const pkgRes = await pool.query(`SELECT price_ghs FROM tenant_packages WHERE tenant_id=$1 AND gb=$2`, [tenantId, gb]);
    if (pkgRes.rows.length === 0) return NextResponse.json({ error: "Package not found." }, { status: 404 });
    const price = pkgRes.rows[0].price_ghs;

    const base = process.env.BASE_URL || `https://${req.headers.get("host")}`;
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystack_secret_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `customer@${business_name.toLowerCase().replace(/[^a-z0-9]/g, "")}.platform`,
        amount: Math.round(price * 100),
        currency: "GHS",
        channels: ["mobile_money", "card"],
        metadata: { tenantId, gb },
        callback_url: `${base}/collect?tenantId=${tenantId}`
      })
    });
    const d = await r.json();
    if (!d.status) return NextResponse.json({ error: d.message || "Paystack error." }, { status: 502 });
    return NextResponse.json({ url: d.data.authorization_url });
  } catch (e) {
    return NextResponse.json({ error: "Payment could not be started." }, { status: 500 });
  }
}
