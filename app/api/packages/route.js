import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { type, gb, days, priceGhs } = await req.json();
  if (!priceGhs) return NextResponse.json({ error: "Enter a price." }, { status: 400 });

  if (type === "time") {
    if (!days) return NextResponse.json({ error: "Enter how many days." }, { status: 400 });
    await pool.query(
      `INSERT INTO tenant_packages (tenant_id, type, days, gb, price_ghs) VALUES ($1,'time',$2,NULL,$3)`,
      [tenantId, days, priceGhs]
    );
  } else {
    if (!gb) return NextResponse.json({ error: "Enter the GB amount." }, { status: 400 });
    await pool.query(
      `INSERT INTO tenant_packages (tenant_id, type, gb, days, price_ghs) VALUES ($1,'data',$2,NULL,$3)`,
      [tenantId, gb, priceGhs]
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req) {
  const url = new URL(req.url);
  const publicTenantId = url.searchParams.get("tenantId");
  if (publicTenantId) {
    const result = await pool.query(`SELECT id, type, gb, days, price_ghs FROM tenant_packages WHERE tenant_id=$1 ORDER BY price_ghs ASC`, [publicTenantId]);
    return NextResponse.json({ packages: result.rows });
  }
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const result = await pool.query(`SELECT id, type, gb, days, price_ghs FROM tenant_packages WHERE tenant_id=$1 ORDER BY price_ghs ASC`, [tenantId]);
  return NextResponse.json({ packages: result.rows });
}
