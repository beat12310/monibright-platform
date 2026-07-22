import { Pool } from "pg";

// Connects to the shared AWS PostgreSQL server (same one FreeRADIUS uses).
// Every tenant's data lives here, scoped by tenant_id.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});
