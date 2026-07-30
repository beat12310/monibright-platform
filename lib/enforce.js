import { pool } from "./db";

// Stops a voucher code being used past the data it was sold with.
//
// THE PROBLEM THIS SOLVES
// Mikrotik-Total-Limit is enforced by the router PER LOGIN SESSION. A customer
// who buys 1GB, uses it, then reconnects is handed a fresh 1GB by the router.
// Repeat forever. The platform could already see the true lifetime total (it is
// what the status page shows) but never acted on it.
//
// WHAT THIS DOES
// Adds up every session ever recorded for a code and, once that reaches the
// amount sold, deletes the code's login record from radcheck. FreeRADIUS then
// refuses the next login attempt.
//
// WHAT THIS DOES NOT DO
// It cannot cut off a session that is already running. Kicking someone off
// mid-download requires the RADIUS server to send a Disconnect-Request, which
// has to be configured on the FreeRADIUS machine itself. So a customer who is
// online right now finishes that session, then cannot log in again.
//
// Everything here is wrapped so that a failure can never break voucher
// creation or the customer's status page - worst case, enforcement is skipped.

// One code. Cheap, exact, safe to call on every status page load.
export async function enforceOne(username) {
  if (!username) return { checked: false };
  try {
    const r = await pool.query(
      `SELECT COALESCE(MIN(NULLIF(value,'')::bigint),0) AS limit_bytes
       FROM radreply
       WHERE username=$1 AND attribute='Mikrotik-Total-Limit' AND value ~ '^[0-9]+$'`,
      [username]
    );
    const limitBytes = Number(r.rows[0]?.limit_bytes || 0);
    if (!limitBytes) return { checked: true, enforced: false };

    const u = await pool.query(
      `SELECT COALESCE(SUM(acctinputoctets),0) + COALESCE(SUM(acctoutputoctets),0) AS used
       FROM radacct WHERE username=$1`,
      [username]
    );
    const usedBytes = Number(u.rows[0]?.used || 0);

    if (usedBytes >= limitBytes) {
      await pool.query(`DELETE FROM radcheck WHERE username=$1`, [username]);
      return { checked: true, enforced: true, usedBytes, limitBytes };
    }
    return { checked: true, enforced: false, usedBytes, limitBytes };
  } catch (e) {
    return { checked: false, error: String(e.message).slice(0, 120) };
  }
}

// Every spent code in one statement. Safe to call periodically.
export async function sweepSpent() {
  try {
    const res = await pool.query(
      `DELETE FROM radcheck rc
       USING (
         SELECT r.username,
                MIN(r.value::bigint) AS limit_bytes,
                COALESCE(SUM(a.acctinputoctets),0) + COALESCE(SUM(a.acctoutputoctets),0) AS used
         FROM radreply r
         LEFT JOIN radacct a ON a.username = r.username
         WHERE r.attribute = 'Mikrotik-Total-Limit'
           AND r.value ~ '^[0-9]+$'
         GROUP BY r.username
       ) spent
       WHERE rc.username = spent.username
         AND spent.limit_bytes > 0
         AND spent.used >= spent.limit_bytes
       RETURNING rc.username`
    );
    const names = [...new Set(res.rows.map(r => r.username))];
    return { swept: names.length, usernames: names };
  } catch (e) {
    return { swept: 0, error: String(e.message).slice(0, 120) };
  }
}
