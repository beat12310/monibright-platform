import { NextResponse } from "next/server";
import { pool } from "../../../../lib/db";

// PUBLIC endpoint - no login required. The router itself fetches this directly
// using its own router key (already embedded in its setup script), so the
// branded WiFi pages can update automatically with zero manual steps.
// ?page=status returns the post-login welcome/usage page instead of the login form.
export async function GET(req) {
  const url = new URL(req.url);
  const routerKey = url.searchParams.get("key");
  const page = url.searchParams.get("page") || "login";
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

  const origin = url.origin;
  const html = page === "status" ? buildStatusPage(t, origin) : buildLoginPage(t, origin, tenantId);
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

// Shown right after a successful login (no "dst" field on the login form, so
// RouterOS serves this instead of jumping straight to the original site).
// $(username), $(uptime), $(bytes-in-nice) etc. are filled in live by the router.
function buildStatusPage(t, origin) {
  const logo = t.portal_logo_url
    ? `<img src="${t.portal_logo_url}" alt="" style="max-height:64px;margin-bottom:12px">`
    : "";
  return `<html>
<head><title>Connected</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:${t.brand_color};min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25)}
h1{font-size:20px;margin:0 0 6px;color:#111}
p{color:#555;font-size:14px;margin:6px 0}
.usage{background:#f5f5f5;border-radius:10px;padding:10px;font-size:13px;color:#333;margin-top:10px}
.bar{background:#e5e5e5;border-radius:6px;height:8px;overflow:hidden;margin-top:6px}
.fill{background:${t.brand_color};height:100%;width:0%}
.warn{color:#c0392b;font-weight:700;margin-top:8px}
.small{font-size:12px;color:#999;margin-top:14px}
</style></head>
<body>
<div class="card">
  ${logo}
  <h1>You're connected, $(username)!</h1>
  <p>Welcome to ${t.business_name || "our"} WiFi. Enjoy your browsing.</p>
  <div class="usage" id="usage">Checking your data balance...</div>
  <p class="small">Redirecting you in a moment&hellip;</p>
  <a href="$(link-logout)" style="display:block;margin-top:10px;font-size:12px;color:#999;text-decoration:underline">Log out of this device</a>
</div>
<script>
(function(){
  var user = "$(username)";
  fetch("${origin}/api/usage?user=" + encodeURIComponent(user))
    .then(function(r){ return r.json(); })
    .then(function(d){
      var el = document.getElementById("usage");
      if (d && d.limitBytes) {
        var pct = Math.min(100, d.percent || 0);
        var msg = pct + "% of your data used";
        var warn = pct >= 85 ? '<div class="warn">Your data is almost finished - buy a new code soon.</div>' : "";
        el.innerHTML = msg + '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>' + warn;
      } else {
        el.innerHTML = "Enjoy your browsing.";
      }
    })
    .catch(function(){ document.getElementById("usage").innerHTML = ""; });
  setTimeout(function(){ window.location.href = "https://www.google.com"; }, 4000);
})();
</script>
</body></html>`;
}
