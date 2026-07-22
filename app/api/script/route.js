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

  const RADIUS_IP = process.env.RADIUS_SERVER_IP || "35.94.30.151";
  const RADIUS_SECRET = process.env.RADIUS_SHARED_SECRET || "MonibrightTestSecret2026";

  const script = `# Monibright Platform - RouterOS setup for "${businessName}"
# Paste this entire block into WebFig > Terminal, then press Enter.

/radius add service=hotspot address=${RADIUS_IP} secret=${RADIUS_SECRET}
/ip hotspot profile add name=mb-profile hotspot-address=192.168.88.1 login-by=http-chap,http-pap use-radius=yes
/ip hotspot add name=mb-hotspot interface=bridge profile=mb-profile disabled=no

:put "Setup complete for ${businessName}. Router key: ${router_key}"
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="monibright-setup-${router_key}.rsc"`
    }
  });
}
