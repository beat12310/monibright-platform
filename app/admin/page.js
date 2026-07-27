"use client";
import { useEffect, useState } from "react";

// Read-only admin overview. Shows nothing that could change a customer's
// account - there are no buttons here that write anything.
export default function Admin() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = "/login"; return; }
      if (!r.ok) { setErr(d.error || "Could not load."); setData(null); }
      else setData(d);
    } catch (e) {
      setErr("Could not reach the server.");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return <main className="card">Loading...</main>;

  if (err) {
    return (
      <main className="card" style={{ background: "#fff3f3", color: "#b00020" }}>
        <h2>Admin</h2>
        <p>{err}</p>
        <button className="cta ghost" onClick={load}>Try again</button>
      </main>
    );
  }

  if (!data) return <main className="card">Nothing to show.</main>;

  const t = data.totals;
  const money = n => "GHS " + Number(n || 0).toFixed(2);
  const when = s => {
    if (!s) return "-";
    try { return new Date(s).toLocaleDateString(); } catch (e) { return "-"; }
  };
  const isActive = r => r.paidUntil && new Date(r.paidUntil).getTime() > Date.now();

  return (
    <>
      <main className="card">
        <h2>Admin overview</h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          Signed in as {data.admin}. This page only reads - nothing here changes any account.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="v">{t.accounts}</div><div className="l">Accounts</div></div>
          <div className="stat"><div className="v">{t.activeSubscriptions}</div><div className="l">Subscribed</div></div>
          <div className="stat"><div className="v">{t.expiredSubscriptions}</div><div className="l">Expired</div></div>
        </div>
        <div className="stat-row">
          <div className="stat"><div className="v">{t.routers}</div><div className="l">Routers</div></div>
          <div className="stat"><div className="v">{t.sales}</div><div className="l">Codes sold</div></div>
          <div className="stat"><div className="v">{money(t.revenue)}</div><div className="l">All time</div></div>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="v">{data.sessionsAvailable ? t.onlineNow : "-"}</div>
            <div className="l">Online now</div>
          </div>
          <div className="stat"><div className="v">{t.paystackConnected}</div><div className="l">Paystack set up</div></div>
        </div>
        {!data.sessionsAvailable && (
          <p style={{ fontSize: 12, color: "#888" }}>
            Live session counts are unavailable - the RADIUS accounting table could not be read from this database.
          </p>
        )}
        <button className="cta ghost" style={{ marginTop: 12 }} onClick={load}>Refresh</button>
      </main>

      <main className="card">
        <h2>Accounts</h2>
        {data.tenants.length === 0 && <p>No accounts yet.</p>}
        {data.tenants.map(r => (
          <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>
                <b>{r.businessName || "(no name)"}</b>{" "}
                <span className="pill">#{r.id}</span>
              </span>
              <span style={{ color: isActive(r) ? "#127a2e" : "#b00020", fontWeight: 700, fontSize: 13 }}>
                {isActive(r) ? "Subscribed" : "Expired"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0" }}>{r.email}</p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
              Plan {r.plan} · renews {when(r.paidUntil)}
              {r.createdAt ? ` · joined ${when(r.createdAt)}` : ""}
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
              {r.routers} router{r.routers === 1 ? "" : "s"} · {r.packages} package{r.packages === 1 ? "" : "s"} ·{" "}
              {r.sales} sold · {money(r.revenue)} ·{" "}
              {r.hasPaystack ? "Paystack connected" : "no Paystack"}
              {data.sessionsAvailable ? ` · ${r.online} online now` : ""}
            </p>
          </div>
        ))}
      </main>
    </>
  );
}
