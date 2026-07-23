import { NextResponse } from "next/server";
import { pool } from "../../../../lib/db";

// PUBLIC endpoint - no login required. The router itself fetches this directly
// using its own router key (already embedded in its setup script), so the
// branded WiFi login page can update automatically with zero manual steps.
export async function GET(req) {
  const routerKey = new URL(req.url).searchParams.get("key");
  if (!routerKey) return new NextResponse("Missing router key", { status: 400 });

  const rr = await pool.query(`SELECT tenant_id FROM tenant_routers WHERE router_key=$1`, [routerKey]);
  if (rr.rows.length === 0) return new NextResponse("Unknown router", { status: 404 });
  const tenantId = rr.rows[0].tenant_id;

  let t;
  try {
    const r = await pool.query(
      `SELECT business_name, COALESCE(brand_color,'#0b2447') AS brand_color,
              COALESCE(portal_welcome,'') AS portal_welcome,
              COALESCE(portal_logo_url,'') AS portal_logo_url,
              COALESCE(support_phone,'') AS support_phone
       FROM tenants WHERE id=$1`, [tenantId]);
    t = r.rows[0] || { business_name: "", brand_color: "#0b2447", portal_welcome: "", portal_logo_url: "", support_phone: "" };
  } catch (e) {
    t = { business_name: "", brand_color: "#0b2447", portal_welcome: "", portal_logo_url: "", support_phone: "" };
  }

  const origin = new URL(req.url).origin;
  const html = buildLoginPage(t, origin, tenantId);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

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
