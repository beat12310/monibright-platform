import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { routerName } = await req.json();
  const routerKey = crypto.randomBytes(6).toString("hex").toUpperCase(); // e.g. A1B2C3D4E5F6

  const result = await pool.query(
    `INSERT INTO tenant_routers (tenant_id, router_name, router_key) VALUES ($1, $2, $3) RETURNING id, router_key`,
    [tenantId, routerName || "My Router", routerKey]
  );
  return NextResponse.json({ ok: true, router: result.rows[0] });
}

export async function GET(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const result = await pool.query(
    `SELECT id, router_name, router_key FROM tenant_routers WHERE tenant_id=$1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return NextResponse.json({ routers: result.rows });
}
