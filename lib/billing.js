import { pool } from "./db";

export const PLANS = {
  basic: { name: "Basic", price_ghs: 120, routers: 1 },
  pro:   { name: "Pro",   price_ghs: 250, routers: 3 }
};

// Returns { plan, active, daysLeft, routerLimit, label }
export async function getBillingStatus(tenantId) {
  const r = await pool.query(`SELECT plan, paid_until FROM tenants WHERE id=$1`, [tenantId]);
  if (r.rows.length === 0) return null;
  const { plan, paid_until } = r.rows[0];
  const now = new Date();
  const until = paid_until ? new Date(paid_until) : now;
  const daysLeft = Math.max(0, Math.ceil((until - now) / 86400000));
  const active = until > now;
  const routerLimit = plan === "pro" ? PLANS.pro.routers : PLANS.basic.routers;
  const label = plan === "trial" ? "Free trial" : (PLANS[plan]?.name || plan);
  return { plan, active, daysLeft, routerLimit, label, paid_until: until.toISOString() };
}
