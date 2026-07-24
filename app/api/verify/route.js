import { NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "../../../lib/db";

export async function GET(req) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const tenantId = url.searchParams.get("tenantId");
  if (!reference || !tenantId) return NextResponse.json({ error: "Missing details." }, { status: 400 });

  const dupCheck = await pool.query(
    `SELECT code, gb, days, ghs FROM tenant_sales WHERE tenant_id=$1 AND source=$2`,
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

  const packageId = d.data.metadata?.packageId;
  const paidGhs = d.data.amount / 100;

  const pkgRes = await pool.query(`SELECT type, gb, days FROM tenant_packages WHERE id=$1 AND tenant_id=$2`, [packageId, tenantId]);
  if (pkgRes.rows.length === 0) return NextResponse.json({ error: "Package no longer exists - contact support." }, { status: 500 });
  const pkg = pkgRes.rows[0];

  const routerRes = await pool.query(`SELECT router_key FROM tenant_routers WHERE tenant_id=$1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
  const routerKey = routerRes.rows[0]?.router_key || "MB00";

  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  const code = `${routerKey.slice(0, 4)}-${suffix}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO radcheck (username, attribute, op, value) VALUES ($1,'Auth-Type',':=','Accept')`, [code]);
    if (pkg.type === "time") {
      const seconds = pkg.days * 86400;
      await client.query(`INSERT INTO radreply (username, attribute, op, value) VALUES ($1,'Session-Timeout',':=',$2)`, [code, String(seconds)]);
    } else {
      const bytes = pkg.gb * 1073741824;
      await client.query(`INSERT INTO radreply (username, attribute, op, value) VALUES ($1,'Mikrotik-Total-Limit',':=',$2)`, [code, String(bytes)]);
    }
    await client.query(
      `INSERT INTO tenant_sales (tenant_id, code, gb, days, ghs, source) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, code, pkg.gb, pkg.days, paidGhs, `momo-ref-${reference}`]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Payment succeeded but code creation failed - contact support." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ code, gb: pkg.gb, days: pkg.days, ghs: paidGhs });
}
