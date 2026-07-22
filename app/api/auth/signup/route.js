import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "../../../../lib/db";
import { signToken } from "../../../../lib/auth";

export async function POST(req) {
  try {
    const { businessName, email, password } = await req.json();
    if (!businessName || !email || !password || password.length < 6) {
      return NextResponse.json({ error: "Please fill all fields. Password needs 6+ characters." }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO tenants (business_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [businessName, email.toLowerCase().trim(), hash]
    );
    const tenantId = result.rows[0].id;
    const token = signToken(tenantId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("mb_session", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: "/" });
    return res;
  } catch (e) {
    if (String(e.message).includes("duplicate key")) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create account. Try again.", debug: String(e.message), stack: String(e.stack).slice(0, 500) }, { status: 500 });
  }
}
