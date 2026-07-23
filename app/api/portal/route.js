import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

const DEFAULT_PORTAL = { business_name: "", brand_color: "#0b2447", portal_welcome: "", portal_logo_url: "", support_phone: "" };

export async function GET(req) {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let t;
    try {
          const r = await pool.query(
                  `SELECT business_name, COALESCE(brand_color,'#0b2447') AS brand_color,
                                COALESCE(portal_welcome,'') AS portal_welcome,
                                              COALESCE(portal_logo_url,'') AS portal_logo_url,
                                                            COALESCE(support_phone,'') AS support_phone
                                                                   FROM tenants WHERE id=$1`, [tenantId]);
          t = r.rows[0] || DEFAULT_PORTAL;
    } catch (e) {
          console.error("GET /api/portal error:", e.message);
          t = DEFAULT_PORTAL;
    }

  if (new URL(req.url).searchParams.get("download") === "1") {
        const html = buildLoginPage(t, new URL(req.url).origin, tenantId);
        return new NextResponse(html, {
                headers: {
                          "Content-Type": "text/html; charset=utf-8",
                          "Content-Disposition": `attachment; filename="login.html"`
                }
        });
  }
    return NextResponse.json({ portal: t });
}

export async function POST(req) {
    try {
          const tenantId = getTenantIdFromRequest(req);
          if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
          const { brandColor, welcome, logoUrl, supportPhone } = await req.json();
          await pool.query(
                  `UPDATE tenants SET brand_color=COALESCE($2,brand_color),
                           portal_welcome=COALESCE($3,portal_welcome),
                                    portal_logo_url=COALESCE($4,portal_logo_url),
                                             support_phone=COALESCE($5,support_phone)
                                                    WHERE id=$1`,
                  [tenantId, brandColor ?? null, welcome ?? null, logoUrl ?? null, supportPhone ?? null]);
          return NextResponse.json({ ok: true });
    } catch (e) {
          console.error("POST /api/portal error:", e.message);
          return NextResponse.json({ error: "Could not save your design. Try again." }, { status: 500 });
    }
}

// MikroTik hotspot login page. $(...) placeholders are filled in by the router itself.
function buildLoginPage(t, origin, tenantId) {
    const logo = t.portal_logo_url
      ? `<img src="${t.portal_logo_url}" alt="" style="max-height:64px;margin-bottom:12px">`
          : "";
    const support = t.support_phone
      ? `<p class="support">Need help or want to buy a code? Call/WhatsApp: <b>${t.support_phone}</b></p>` : "";
    const welcome = t.portal_welcome || `Welcome to ${t.business_name || "our"} WiFi`;
    return `<html>
    <head><title>${t.business_name || "WiFi"}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:${t.brand_color};min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25)}
    h1{font-size:20px;margin:0 0 6px;color:#111}
    p{color:#555;font-size:14px;margin:6px 0 16px}
    input{width:100%;box-sizing:border-box;padding:12px;border:1.5px solid #ddd;border-radius:10px;font-size:16px;text-align:center;letter-spacing:1px}
    button{width:100%;margin-top:12px;padding:13px;border:0;border-radius:10px;background:${t.brand_color};color:#fff;font-size:16px;font-weight:700;cursor:pointer}
    .err{color:#c0392b;font-size:13px;min-height:16px;margin-top:8px}
    .buy{display:block;margin-top:14px;font-size:14px;color:${t.brand_color};font-weight:600;text-decoration:none}
    .support{font-size:12px;color:#777;margin-top:14px}
    </style></head>
    <body>
    <div class="card">
      ${logo}
        <h1>${welcome}</h1>
          <p>Enter your voucher code to get online</p>
            <form name="login" action="$(link-login-only)" method="post">
                <input type="hidden" name="dst" value="$(link-orig)">
                    <input type="hidden" name="popup" value="true">
                        <input name="username" placeholder="Voucher code" autocomplete="off" oninput="document.login.password.value=this.value">
                            <input type="hidden" name="password">
                                <button type="submit">Connect</button>
                                  </form>
                                    <div class="err">$(error)</div>
                                      <a class="buy" href="${origin}/buy?tenantId=${tenantId}">Buy a code with MoMo &rarr;</a>
                                        ${support}
                                        </div>
                                        </body></html>`;
}
