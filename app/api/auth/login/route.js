import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "../../../../lib/db";
import { signToken } from "../../../../lib/auth";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const result = await pool.query(`SELECT id, password_hash FROM tenants WHERE email = $1`, [email.toLowerCase().trim()]);
    if (result.rows.length === 0) return NextResponse.json({ error: "No account with that email." }, { status: 401 });
    const ok = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!ok) return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    const token = signToken(result.rows[0].id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("mb_session", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }
}
