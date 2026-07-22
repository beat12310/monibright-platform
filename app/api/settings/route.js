import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { paystackSecretKey, brandColor } = await req.json();
  if (paystackSecretKey) {
    await pool.query(`UPDATE tenants SET paystack_secret_key=$1 WHERE id=$2`, [paystackSecretKey, tenantId]);
  }
  if (brandColor) {
    await pool.query(`UPDATE tenants SET brand_color=$1 WHERE id=$2`, [brandColor, tenantId]);
  }
  return NextResponse.json({ ok: true });
}
