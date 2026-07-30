import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { enforceOne } from "../../../lib/enforce";

// PUBLIC endpoint - the router's own status page calls this to show a
// "data almost finished" warning. Only ever returns totals for the voucher
// code itself (the caller already has to know that code), nothing else.
//
// It now also ENFORCES the limit. This page is loaded by the customer's own
// phone every time they log in, which makes it the earliest and most reliable
// moment to notice that a code is spent and stop it being used again.
export async function GET(req) {
  const user = new URL(req.url).searchParams.get("user");
  if (!user) return NextResponse.json({ error: "Missing user" }, { status: 400 });

  try {
    const limitRes = await pool.query(
      `SELECT value FROM radreply WHERE username=$1 AND attribute='Mikrotik-Total-Limit' LIMIT 1`, [user]);
    const limitBytes = limitRes.rows.length ? Number(limitRes.rows[0].value) : 0;

    const usedRes = await pool.query(
      `SELECT COALESCE(SUM(acctinputoctets),0) + COALESCE(SUM(acctoutputoctets),0) AS used
       FROM radacct WHERE username=$1`, [user]);
    const usedBytes = Number(usedRes.rows[0]?.used || 0);

    const percent = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 100) : null;

    // Spent codes are retired here so they cannot be logged in with again.
    let spent = false;
    if (limitBytes > 0 && usedBytes >= limitBytes) {
      const r = await enforceOne(user);
      spent = !!r.enforced;
    }

    return NextResponse.json({ usedBytes, limitBytes, percent, spent });
  } catch (e) {
    return NextResponse.json({ usedBytes: 0, limitBytes: 0, percent: null });
  }
}
