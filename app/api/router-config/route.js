import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { sweepSpent } from "../../../lib/enforce";

// Public endpoint. The router fetches this every couple of minutes and imports
// it, so whatever the owner types on the dashboard reaches the hardware without
// anyone touching a terminal.
//
// Deliberately narrow: it sets the WiFi name, refreshes the two portal pages,
// and disconnects voucher codes that have used up the data they were sold with.
// It never contains passwords, RADIUS secrets or anything that could lock an
// owner out of their own router. Keep it that way - this file is executed as
// admin on every customer's router.
//
// Authentication is the 12-character router key. That is enough for something
// that carries no secrets, but it is NOT enough to ever carry credentials.

export const dynamic = "force-dynamic";

function toSsid(name) {
  const clean = String(name || "")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .slice(0, 30);
  return clean || "WiFi";
}

function plain(body, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").trim().toUpperCase();

  // A malformed key must not reach the database.
  if (!/^[0-9A-F]{8,32}$/.test(key)) {
    return plain("# Monibright: invalid router key\n", 404);
  }

  let rows;
  try {
    const r = await pool.query(
      `SELECT router_name FROM tenant_routers WHERE router_key=$1`,
      [key]
    );
    rows = r.rows;
  } catch (e) {
    // Fail closed. A 500 makes /tool fetch fail on the router, which aborts the
    // sync script before /import runs - so a database hiccup can never leave a
    // half-written config behind.
    return plain("# Monibright: temporary server error\n", 500);
  }

  // Router was removed from the dashboard: send a 404 so the fetch fails and
  // nothing is imported. The router keeps running its current config untouched.
  if (rows.length === 0) {
    return plain("# Monibright: this router is no longer registered\n", 404);
  }

  const ssid = toSsid(rows[0].router_name);
  const origin = url.origin;

  // Retire spent codes so they cannot log in again. Never allowed to break the
  // config the router is waiting for.
  try { await sweepSpent(); } catch (e) {}

  // Codes belonging to THIS router that have used their whole allowance and
  // are still holding a session open. Voucher codes are "<first 4 of key>-XXXX".
  let spentUsers = [];
  try {
    const s = await pool.query(
      `SELECT r.username
       FROM radreply r
       LEFT JOIN radacct a ON a.username = r.username
       WHERE r.attribute = 'Mikrotik-Total-Limit'
         AND r.value ~ '^[0-9]+$'
         AND r.username LIKE $1
       GROUP BY r.username
       HAVING COALESCE(SUM(a.acctinputoctets),0) + COALESCE(SUM(a.acctoutputoctets),0)
              >= MIN(r.value::bigint)
       LIMIT 60`,
      [key.slice(0, 4) + "-%"]
    );
    // Only well-formed codes are ever written into a router command.
    spentUsers = s.rows
      .map(x => String(x.username || ""))
      .filter(u => /^[A-Z0-9-]{4,32}$/.test(u));
  } catch (e) {
    spentUsers = [];
  }

  const kickBlock = spentUsers.length
    ? `
# --- Disconnect codes that have used up their data ---
# Their login has already been removed on the server, so they cannot come back.
:do {
  :foreach u in={${spentUsers.map(u => `"${u}"`).join(";")}} do={
    :foreach s in=[/ip hotspot active find user=$u] do={
      /ip hotspot active remove $s
      :log info ("Monibright: disconnected " . $u . " - data finished")
    }
  }
} on-error={
  :log warning "Monibright: could not disconnect finished users"
}
`
    : "\n# No codes have run out on this router.\n";

  // The SSID is only written when it actually differs. Setting it every cycle
  // would bounce the radio every 2 minutes and drop every paying customer.
  const script = `# Monibright auto-config - generated ${new Date().toISOString()}
# Applied automatically by the monibright-sync scheduler. Do not edit by hand.

:local want "${ssid}"

:do {
  :foreach i in=[/interface wifi find] do={
    :local now [/interface wifi get $i configuration.ssid]
    :if ($now != $want) do={
      /interface wifi set $i configuration.ssid=$want
      :log info ("Monibright: WiFi name changed from '" . $now . "' to '" . $want . "'")
    }
  }
} on-error={
  :log warning "Monibright: could not apply WiFi name on this model"
}
${kickBlock}
:do {
  /tool fetch url="${origin}/api/portal/live?key=${key}" dst-path=hotspot/login.html
  /tool fetch url="${origin}/api/portal/live?key=${key}&page=status" dst-path=hotspot/status.html
} on-error={
  :log warning "Monibright: could not refresh portal pages"
}
`;

  return plain(script);
}
