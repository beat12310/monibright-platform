import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { paystackSecretKey, brandColor } = await req.json();

  if (paystackSecretKey) {
    if (!/^sk_(test|live)_/.test(paystackSecretKey.trim())) {
      return NextResponse.json({ error: "That doesn't look like a Paystack SECRET key (it starts with sk_live_ or sk_test_)." }, { status: 400 });
    }
    // Verify the key actually works before saving it
    const check = await fetch("https://api.paystack.co/transaction?perPage=1", {
      headers: { Authorization: `Bearer ${paystackSecretKey.trim()}` }
    });
    if (check.status === 401) {
      return NextResponse.json({ error: "Paystack rejected this key. Copy it again from your Paystack dashboard (Settings > API Keys)." }, { status: 400 });
    }
    await pool.query(`UPDATE tenants SET paystack_secret_key=$1 WHERE id=$2`, [paystackSecretKey.trim(), tenantId]);
  }
  if (brandColor) {
    await pool.query(`UPDATE tenants SET brand_color=$1 WHERE id=$2`, [brandColor, tenantId]);
  }
  return NextResponse.json({ ok: true, verified: !!paystackSecretKey });
}
