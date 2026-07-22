import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function GET(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const tenant = await pool.query(
    `SELECT business_name, email, brand_color, plan, subscription_active, paystack_secret_key IS NOT NULL AS has_paystack FROM tenants WHERE id=$1`,
    [tenantId]
  );
  const routers = await pool.query(
    `SELECT id, router_name, router_key, created_at FROM tenant_routers WHERE tenant_id=$1 ORDER BY created_at DESC`,
    [tenantId]
  );
  const packages = await pool.query(
    `SELECT id, gb, price_ghs FROM tenant_packages WHERE tenant_id=$1 ORDER BY gb ASC`,
    [tenantId]
  );
  const sales = await pool.query(
    `SELECT gb, ghs, source, created_at FROM tenant_sales WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 30`,
    [tenantId]
  );
  const totals = await pool.query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(ghs),0) AS total FROM tenant_sales WHERE tenant_id=$1`,
    [tenantId]
  );

  return NextResponse.json({
    tenantId,
    tenant: tenant.rows[0],
    routers: routers.rows,
    packages: packages.rows,
    sales: sales.rows,
    totalSales: totals.rows[0]
  });
}
