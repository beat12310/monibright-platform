import { Pool } from "pg";

// Connects to the shared AWS PostgreSQL server (same one FreeRADIUS uses).
// Every tenant's data lives here, scoped by tenant_id.
//
// The connection is now encrypted. It used to be ssl: false, which sent the
// database password and every row - including saved Paystack secret keys -
// across the public internet in the clear.
//
// rejectUnauthorized is false because a self-managed Postgres on EC2 normally
// presents a self-signed certificate. That still encrypts the traffic; it just
// does not prove the server's identity. To go further, point PGSSLROOTCERT at
// the server's CA certificate and flip this to true.
//
// ESCAPE HATCH: if the server has no TLS support at all, the app will fail to
// connect. Set DB_SSL=off in Vercel and redeploy to restore the old behaviour,
// then enable TLS on the Postgres server and remove that variable.
const sslDisabled = String(process.env.DB_SSL || "").trim().toLowerCase() === "off";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : { rejectUnauthorized: false }
});
