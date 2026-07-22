import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { gb, priceGhs } = await req.json();
  if (!gb || !priceGhs) return NextResponse.json({ error: "Enter both GB and price." }, { status: 400 });
  await pool.query(
    `INSERT INTO tenant_packages (tenant_id, gb, price_ghs) VALUES ($1,$2,$3)`,
    [tenantId, gb, priceGhs]
  );
  return NextResponse.json({ ok: true });
}

export async function GET(req) {
  const url = new URL(req.url);
  const publicTenantId = url.searchParams.get("tenantId");
  if (publicTenantId) {
    const result = await pool.query(`SELECT id, gb, price_ghs FROM tenant_packages WHERE tenant_id=$1 ORDER BY gb ASC`, [publicTenantId]);
    return NextResponse.json({ packages: result.rows });
  }
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const result = await pool.query(`SELECT id, gb, price_ghs FROM tenant_packages WHERE tenant_id=$1 ORDER BY gb ASC`, [tenantId]);
  return NextResponse.json({ packages: result.rows });
}
