import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";

// PUBLIC endpoint - the router's own status page calls this to show a
// "data almost finished" warning. Only ever returns totals for the voucher
// code itself (the caller already has to know that code), nothing else.
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
    return NextResponse.json({ usedBytes, limitBytes, percent });
  } catch (e) {
    return NextResponse.json({ usedBytes: 0, limitBytes: 0, percent: null });
  }
}
