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
  const { router_key } = routerRes.rows[0];

  const tenantRes = await pool.query(`SELECT business_name FROM tenants WHERE id=$1`, [tenantId]);
  const businessName = tenantRes.rows[0].business_name;
  const ssid = (businessName + " WiFi").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 30);

  const RADIUS_IP = process.env.RADIUS_SERVER_IP || "35.94.30.151";
  const RADIUS_SECRET = process.env.RADIUS_SHARED_SECRET || "MonibrightTestSecret2026";
  const origin = new URL(req.url).origin;

  const script = `# ============================================
# Monibright setup for "${businessName}"
# Router key: ${router_key}
# Paste this WHOLE block into WebFig > Terminal, press Enter.
# ============================================

# 1. Move the router admin page to port 8080 so the hotspot never locks you out.
#    After this runs, your admin page is:  http://192.168.88.1:8080
/ip service set www port=8080

# 2. Link this router to the Monibright cloud server
/radius add service=hotspot address=${RADIUS_IP} secret=${RADIUS_SECRET} comment="Monibright"

# 3. Open the WiFi (no WiFi password - the voucher page is the security)
/interface wifi set [find default-name=wifi1] configuration.mode=ap configuration.ssid="${ssid}" security.authentication-types="" disabled=no

# 4. Create the hotspot on the whole network
/ip hotspot profile add name=mb-profile hotspot-address=192.168.88.1 login-by=http-chap,http-pap use-radius=yes
/ip hotspot add name=mb-hotspot interface=bridge profile=mb-profile disabled=no

# 5. Owner protection: your own devices can always reach this router's pages
/ip hotspot walled-garden ip add action=accept dst-address=192.168.88.1 comment="Always allow router pages"

# 6. Download your branded WiFi login page automatically (no manual upload needed).
#    Whenever you change the design on your dashboard, just run this ONE line again:
/tool fetch url="${origin}/api/portal/live?key=${router_key}" dst-path=hotspot/login.html

:put "=============================================="
:put "SETUP COMPLETE for ${businessName}"
:put "WiFi name: ${ssid}"
:put "Your admin page moved to: http://192.168.88.1:8080"
:put "Your branded login page is installed automatically."
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
