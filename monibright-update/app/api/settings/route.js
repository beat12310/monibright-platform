import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";
import { encryptSecret } from "../../../lib/crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { paystackSecretKey, brandColor, email } = await req.json();
  const result = { ok: true };

  if (paystackSecretKey) {
    if (!/^sk_(test|live)_/.test(paystackSecretKey.trim())) {
      return NextResponse.json({ error: "That doesn't look like a Paystack SECRET key (it starts with sk_live_ or sk_test_)." }, { status: 400 });
    }
    // Verify the key actually works before saving it
    const check = await fetch("https://api.paystack.co/transaction?perPage=1", {
      headers: { Authorization: `Bearer ${paystackSecretKey.trim()}` }
    });
    if (check.status === 401) {
      return NextResponse.json({ error: "Paystack rejected this key. Copy it again from your Paystack dashboard (Settings > API Keys)." }, { status: 400 });
    }
    // Stored encrypted, so a leaked database dump does not expose the key.
    await pool.query(
      `UPDATE tenants SET paystack_secret_key=$1 WHERE id=$2`,
      [encryptSecret(paystackSecretKey.trim()), tenantId]
    );
    result.verified = true;
  }

  if (brandColor) {
    await pool.query(`UPDATE tenants SET brand_color=$1 WHERE id=$2`, [brandColor, tenantId]);
  }

  // --- Change the account email (the address you sign in with) ---
  if (email) {
    const clean = String(email).toLowerCase().trim();

    if (!EMAIL_RE.test(clean)) {
      return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
    }

    const current = await pool.query(`SELECT email FROM tenants WHERE id=$1`, [tenantId]);
    if (current.rows[0]?.email === clean) {
      return NextResponse.json({ error: "That is already your email address." }, { status: 400 });
    }

    const taken = await pool.query(`SELECT id FROM tenants WHERE email=$1 AND id<>$2`, [clean, tenantId]);
    if (taken.rows.length > 0) {
      return NextResponse.json({ error: "Another account already uses that email address." }, { status: 409 });
    }

    await pool.query(`UPDATE tenants SET email=$1 WHERE id=$2`, [clean, tenantId]);
    result.email = clean;
    result.emailChanged = true;
  }

  return NextResponse.json(result);
}
