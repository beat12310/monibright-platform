import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "../../../lib/db";

export async function GET(req) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const tenantId = url.searchParams.get("tenantId");
  if (!reference || !tenantId) return NextResponse.json({ error: "Missing details." }, { status: 400 });

  const dupCheck = await pool.query(
    `SELECT code, gb, ghs FROM tenant_sales WHERE tenant_id=$1 AND source=$2`,
    [tenantId, `momo-ref-${reference}`]
  );
  if (dupCheck.rows.length > 0) {
    return NextResponse.json(dupCheck.rows[0]);
  }

  const tenantRes = await pool.query(`SELECT paystack_secret_key FROM tenants WHERE id=$1`, [tenantId]);
  if (tenantRes.rows.length === 0) return NextResponse.json({ error: "Unknown business." }, { status: 404 });
  const { paystack_secret_key } = tenantRes.rows[0];

  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystack_secret_key}` }
  });
  const d = await r.json();
  if (!d.status || d.data?.status !== "success") {
    return NextResponse.json({ error: "Payment not confirmed yet. Refresh in a moment." }, { status: 402 });
  }

  const gb = Number(d.data.metadata?.gb);
  const paidGhs = d.data.amount / 100;

  const routerRes = await pool.query(`SELECT router_key FROM tenant_routers WHERE tenant_id=$1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
  const routerKey = routerRes.rows[0]?.router_key || "MB00";

  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  const code = `${routerKey.slice(0, 4)}-${suffix}`;
  const bytes = gb * 1073741824;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO radcheck (username, attribute, op, value) VALUES ($1,'Auth-Type',':=','Accept')`, [code]);
    await client.query(`INSERT INTO radreply (username, attribute, op, value) VALUES ($1,'Mikrotik-Total-Limit',':=',$2)`, [code, String(bytes)]);
    await client.query(
      `INSERT INTO tenant_sales (tenant_id, code, gb, ghs, source) VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, code, gb, paidGhs, `momo-ref-${reference}`]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Payment succeeded but code creation failed - contact support." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ code, gb, ghs: paidGhs });
}
