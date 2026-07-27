import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

// READ-ONLY admin overview.
//
// This file is new. It changes nothing that existing customers run - their
// login, dashboard, portal, vouchers and payments execute exactly the same
// code as before. Nothing here writes to the database. Every query is wrapped
// individually, so a column this deployment has never seen cannot take the
// page down; that section simply reports nothing.
//
// Access: any signed-in account whose email appears in the ADMIN_EMAILS
// environment variable (comma separated). If that variable is missing, nobody
// is admin - it fails closed rather than open.

export const dynamic = "force-dynamic";

function adminList() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    return fallback;
  }
}

export async function GET(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const admins = adminList();
  if (admins.length === 0) {
    return NextResponse.json(
      { error: "No admin is configured. Set ADMIN_EMAILS in Vercel, then redeploy." },
      { status: 403 }
    );
  }

  const me = await safe(
    async () => (await pool.query(`SELECT email FROM tenants WHERE id=$1`, [tenantId])).rows[0]?.email,
    null
  );
  if (!me || !admins.includes(String(me).toLowerCase())) {
    return NextResponse.json({ error: "You do not have access to this page." }, { status: 403 });
  }

  let tenants = await safe(
    async () => (await pool.query(
      `SELECT id, business_name, email, plan, paid_until, created_at,
              (paystack_secret_key IS NOT NULL) AS has_paystack
       FROM tenants ORDER BY id ASC`
    )).rows,
    null
  );
  if (!tenants) {
    tenants = await safe(
      async () => (await pool.query(
        `SELECT id, business_name, email, plan, paid_until,
                (paystack_secret_key IS NOT NULL) AS has_paystack
         FROM tenants ORDER BY id ASC`
      )).rows,
      []
    );
  }

  const routerRows = await safe(
    async () => (await pool.query(
      `SELECT tenant_id, COUNT(*)::int AS c FROM tenant_routers GROUP BY tenant_id`
    )).rows,
    []
  );

  const salesRows = await safe(
    async () => (await pool.query(
      `SELECT tenant_id, COUNT(*)::int AS c, COALESCE(SUM(ghs),0)::float AS total
       FROM tenant_sales GROUP BY tenant_id`
    )).rows,
    []
  );

  const packageRows = await safe(
    async () => (await pool.query(
      `SELECT tenant_id, COUNT(*)::int AS c FROM tenant_packages GROUP BY tenant_id`
    )).rows,
    []
  );

  const routerKeys = await safe(
    async () => (await pool.query(
      `SELECT tenant_id, router_key FROM tenant_routers`
    )).rows,
    []
  );

  const liveSessions = await safe(
    async () => (await pool.query(
      `SELECT username FROM radacct WHERE acctstoptime IS NULL`
    )).rows.map(r => r.username),
    null
  );

  const byTenant = new Map();
  for (const t of tenants) {
    byTenant.set(t.id, {
      id: t.id,
      businessName: t.business_name,
      email: t.email,
      plan: t.plan || "trial",
      paidUntil: t.paid_until || null,
      createdAt: t.created_at || null,
      hasPaystack: !!t.has_paystack,
      routers: 0,
      packages: 0,
      sales: 0,
      revenue: 0,
      online: 0
    });
  }
  for (const r of routerRows) if (byTenant.has(r.tenant_id)) byTenant.get(r.tenant_id).routers = r.c;
  for (const p of packageRows) if (byTenant.has(p.tenant_id)) byTenant.get(p.tenant_id).packages = p.c;
  for (const s of salesRows) {
    if (byTenant.has(s.tenant_id)) {
      byTenant.get(s.tenant_id).sales = s.c;
      byTenant.get(s.tenant_id).revenue = Number(s.total) || 0;
    }
  }

  let onlineTotal = null;
  if (Array.isArray(liveSessions)) {
    onlineTotal = liveSessions.length;
    const prefixToTenant = new Map();
    for (const rk of routerKeys) {
      if (rk.router_key) prefixToTenant.set(String(rk.router_key).slice(0, 4).toUpperCase(), rk.tenant_id);
    }
    for (const u of liveSessions) {
      const prefix = String(u || "").slice(0, 4).toUpperCase();
      const tid = prefixToTenant.get(prefix);
      if (tid && byTenant.has(tid)) byTenant.get(tid).online += 1;
    }
  }

  const rows = [...byTenant.values()];
  const now = Date.now();
  const activeCount = rows.filter(r => r.paidUntil && new Date(r.paidUntil).getTime() > now).length;

  return NextResponse.json({
    admin: me,
    generatedAt: new Date().toISOString(),
    totals: {
      accounts: rows.length,
      activeSubscriptions: activeCount,
      expiredSubscriptions: rows.length - activeCount,
      paystackConnected: rows.filter(r => r.hasPaystack).length,
      routers: rows.reduce((a, r) => a + r.routers, 0),
      sales: rows.reduce((a, r) => a + r.sales, 0),
      revenue: Number(rows.reduce((a, r) => a + r.revenue, 0).toFixed(2)),
      onlineNow: onlineTotal
    },
    sessionsAvailable: Array.isArray(liveSessions),
    tenants: rows
  });
}
