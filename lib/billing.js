import { pool } from "./db";

export const PLANS = {
  basic: { name: "Basic", price_ghs: 120, routers: 1 },
  pro:   { name: "Pro",   price_ghs: 250, routers: 3 }
};

// Returns { plan, active, daysLeft, routerLimit, label } - never throws.
export async function getBillingStatus(tenantId) {
  try {
    let r = await pool.query(`SELECT plan, paid_until FROM tenants WHERE id=$1`, [tenantId]);
    if (r.rows.length === 0) return null;

    let { plan, paid_until } = r.rows[0];

    // Self-heal: if this row predates the billing columns, give it a fresh 14-day trial now.
    if (!plan || !paid_until) {
      plan = plan || "trial";
      await pool.query(
        `UPDATE tenants SET plan=$2, paid_until=COALESCE(paid_until, NOW() + INTERVAL '14 days') WHERE id=$1`,
        [tenantId, plan]
      );
      r = await pool.query(`SELECT plan, paid_until FROM tenants WHERE id=$1`, [tenantId]);
      ({ plan, paid_until } = r.rows[0]);
    }

    const now = new Date();
    const until = new Date(paid_until);
    const daysLeft = Math.max(0, Math.ceil((until - now) / 86400000));
    const active = until > now;
    const routerLimit = plan === "pro" ? PLANS.pro.routers : PLANS.basic.routers;
    const label = plan === "trial" ? "Free trial" : (PLANS[plan]?.name || plan);
    return { plan, active, daysLeft, routerLimit, label, paid_until: until.toISOString() };
  } catch (e) {
    // Never let a billing hiccup take down the dashboard - fail open with a safe default.
    console.error("getBillingStatus error:", e.message);
    return { plan: "trial", active: true, daysLeft: 14, routerLimit: 1, label: "Free trial", paid_until: new Date(Date.now() + 14 * 86400000).toISOString(), _degraded: true };
  }
}
