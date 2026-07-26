import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";
import { getBillingStatus } from "../../../lib/billing";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const billing = await getBillingStatus(tenantId);
  if (!billing?.active) return NextResponse.json({ error: "Your subscription has expired. Renew to add routers." }, { status: 402 });
  const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM tenant_routers WHERE tenant_id=$1`, [tenantId]);
  if (cnt.rows[0].c >= billing.routerLimit) {
    return NextResponse.json({ error: `Your ${billing.label} plan allows ${billing.routerLimit} router(s). Upgrade to Pro for more.` }, { status: 402 });
  }

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

// --- Remove a router you no longer use ---
// Scoped by tenant_id so one account can never delete another account's router.
export async function DELETE(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const routerId = Number(searchParams.get("routerId"));
  if (!routerId) return NextResponse.json({ error: "Which router do you want to remove?" }, { status: 400 });

  try {
    const result = await pool.query(
      `DELETE FROM tenant_routers WHERE id=$1 AND tenant_id=$2 RETURNING id, router_name, router_key`,
      [routerId, tenantId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Router not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: result.rows[0] });
  } catch (e) {
    // 23503 = foreign key violation: something else still points at this router
    if (e?.code === "23503") {
      return NextResponse.json({ error: "This router still has records attached to it and can't be removed yet." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not remove that router. Try again." }, { status: 500 });
  }
}
