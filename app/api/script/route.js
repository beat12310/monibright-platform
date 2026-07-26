import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getTenantIdFromRequest } from "../../../lib/auth";

export async function GET(req) {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const routerId = new URL(req.url).searchParams.get("routerId");
  const routerRes = await pool.query(
    `SELECT router_key, router_name FROM tenant_routers WHERE id=$1 AND tenant_id=$2`,
    [routerId, tenantId]
  );
  if (routerRes.rows.length === 0) return NextResponse.json({ error: "Router not found." }, { status: 404 });
  const { router_key, router_name } = routerRes.rows[0];

  const tenantRes = await pool.query(`SELECT business_name FROM tenants WHERE id=$1`, [tenantId]);
  const businessName = tenantRes.rows[0].business_name;

  // The WiFi name now comes from the router's own name, so the owner can change
  // it on the dashboard at any time and the sync scheduler pushes it out.
  const ssid = (router_name || businessName || "WiFi")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .slice(0, 30) || "WiFi";

  const RADIUS_IP = process.env.RADIUS_SERVER_IP || "35.94.30.151";
  const RADIUS_SECRET = process.env.RADIUS_SHARED_SECRET || "MonibrightTestSecret2026";
  const origin = new URL(req.url).origin;

  const script = `# ============================================
# Monibright setup for "${businessName}"
# Router key: ${router_key}
# WiFi name:  ${ssid}
# Paste this WHOLE block into WebFig > Terminal, press Enter.
# ============================================

# 1. Move the router admin page to port 8080 so the hotspot never locks you out.
# After this runs, your admin page is: http://192.168.88.1:8080
/ip service set www port=8080

# 2. Link this router to the Monibright cloud server
/radius add service=hotspot address=${RADIUS_IP} secret=${RADIUS_SECRET} comment="Monibright"

# 3. Open the WiFi - configures EVERY built-in WiFi radio this router has
# (some models have two, e.g. 2.4GHz + 5GHz - this covers all of them).
# No WiFi password: the voucher page is the security.
/interface wifi set [find] configuration.mode=ap configuration.ssid="${ssid}" security.authentication-types="" disabled=no

# 4. Create the hotspot on the whole network
/ip hotspot profile add name=mb-profile hotspot-address=192.168.88.1 login-by=http-chap,http-pap use-radius=yes
/ip hotspot add name=mb-hotspot interface=bridge profile=mb-profile disabled=no

# 5. Owner protection: your own devices can always reach this router's pages
/ip hotspot walled-garden ip add action=accept dst-address=192.168.88.1 comment="Always allow router pages"

# 6. Download your branded WiFi pages
/tool fetch url="${origin}/api/portal/live?key=${router_key}" dst-path=hotspot/login.html
/tool fetch url="${origin}/api/portal/live?key=${router_key}&page=status" dst-path=hotspot/status.html

# 7. Trust real certificates.
# The router is about to start running configuration sent by the server, so it
# has to be able to prove it is really talking to Monibright and not to someone
# sitting in the middle of the connection. This loads the standard list of
# certificate authorities that every browser already trusts.
:do {
  /tool fetch url="https://curl.se/ca/cacert.pem" dst-path=cacert.pem
  /certificate import file-name=cacert.pem passphrase=""
  :put "Certificate authorities installed."
} on-error={
  :put "WARNING: could not install certificate authorities - automatic updates will not run."
}

# 8. Automatic updates.
# Every 2 minutes this router asks Monibright whether anything changed - the
# WiFi name, the look of the login page - and applies it. That is what lets the
# owner change things on the website without ever touching this terminal.
# It only ever pulls; nothing can connect in to this router from outside.
/system script remove [find name="monibright-sync"]
/system script add name=monibright-sync policy=read,write,policy,test,ftp source={
:do {
/tool fetch url="${origin}/api/router-config?key=${router_key}" check-certificate=yes dst-path=monibright-config.rsc
:delay 2s
/import file-name=monibright-config.rsc
} on-error={
:log warning "Monibright: sync failed, keeping current settings"
}
}
/system scheduler remove [find name="monibright-sync"]
/system scheduler add name=monibright-sync interval=2m on-event="/system script run monibright-sync" comment="Monibright automatic updates"

# Run it once now so everything is in step immediately.
/system script run monibright-sync

:put "=============================================="
:put "SETUP COMPLETE for ${businessName}"
:put "WiFi name: ${ssid}"
:put "Your admin page moved to: http://192.168.88.1:8080"
:put "Change the WiFi name on your dashboard - this router updates itself."
:put "Customers: connect to the WiFi and enter a voucher code."
:put "=============================================="
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="Monibright-Router-Setup-${router_key}.rsc.txt"`
    }
  });
}
