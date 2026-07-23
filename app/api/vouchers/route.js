import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";
import { getBillingStatus } from "../../../lib/billing";

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const billing = await getBillingStatus(tenantId);
  if (!billing?.active) return NextResponse.json({ error: "Your subscription has expired. Renew on the Billing card to keep selling." }, { status: 402 });

  const { routerId, gb, count } = await req.json();
  const n = Math.max(1, Math.min(200, Number(count) || 1));

  const routerRes = await pool.query(
    `SELECT router_key FROM tenant_routers WHERE id=$1 AND tenant_id=$2`,
    [routerId, tenantId]
  );
  if (routerRes.rows.length === 0) return NextResponse.json({ error: "Router not found." }, { status: 404 });
  const routerKey = routerRes.rows[0].router_key;

  const pkgRes = await pool.query(
    `SELECT price_ghs FROM tenant_packages WHERE tenant_id=$1 AND gb=$2`,
    [tenantId, gb]
  );
  if (pkgRes.rows.length === 0) return NextResponse.json({ error: "That package size doesn't exist yet - add it first." }, { status: 400 });
  const price = pkgRes.rows[0].price_ghs;

  const codes = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < n; i++) {
      const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
      const code = `${routerKey.slice(0, 4)}-${suffix}`;
      const bytes = gb * 1073741824;
      await client.query(`INSERT INTO radcheck (username, attribute, op, value) VALUES ($1,'Auth-Type',':=','Accept')`, [code]);
      await client.query(`INSERT INTO radreply (username, attribute, op, value) VALUES ($1,'Mikrotik-Total-Limit',':=',$2)`, [code, String(bytes)]);
      codes.push(code);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Could not generate codes." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ codes, gb, price });
}
