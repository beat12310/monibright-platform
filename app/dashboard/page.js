"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [routerName, setRouterName] = useState("");
  const [pkgGb, setPkgGb] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [genRouter, setGenRouter] = useState("");
  const [genGb, setGenGb] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [genResult, setGenResult] = useState(null);
  const [paystackKey, setPaystackKey] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [tenantId, setTenantId] = useState(null);

  async function load() {
    const r = await fetch("/api/dashboard");
    if (r.status === 401) { window.location.href = "/login"; return; }
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function addRouter() {
    await fetch("/api/routers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routerName }) });
    setRouterName(""); load();
  }
  async function addPackage() {
    await fetch("/api/packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gb: Number(pkgGb), priceGhs: Number(pkgPrice) }) });
    setPkgGb(""); setPkgPrice(""); load();
  }
  async function generate() {
    const r = await fetch("/api/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routerId: genRouter, gb: Number(genGb), count: Number(genCount) }) });
    const d = await r.json();
    setGenResult(d);
  }
  async function saveSettings() {
    setSettingsMsg("Saving...");
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paystackSecretKey: paystackKey }) });
    setSettingsMsg("Saved!");
    load();
  }
  function downloadScript(routerId) {
    window.location.href = `/api/script?routerId=${routerId}`;
  }

  if (!data) return <main className="card">Loading...</main>;
  if (data.error) return <main className="card err">{data.error}</main>;

  return (
    <>
      <main className="card">
        <h2>{data.tenant.business_name}</h2>
        <div className="stat-row">
          <div className="stat"><div className="v">{data.totalSales.count}</div><div className="l">Total sales</div></div>
          <div className="stat"><div className="v">GHS {data.totalSales.total}</div><div className="l">All time</div></div>
          <div className="stat"><div className="v">{data.tenant.has_paystack ? "Yes" : "No"}</div><div className="l">Paystack connected</div></div>
        </div>
      </main>

      <main className="card">
        <h2>Your routers</h2>
        {data.routers.map((r) => (
          <div className="row" key={r.id}>
            <span>{r.router_name} <span className="pill">{r.router_key}</span></span>
            <button className="cta ghost" style={{ width: "auto", padding: "6px 12px", margin: 0 }} onClick={() => downloadScript(r.id)}>Download script</button>
          </div>
        ))}
        <label>New router name</label>
        <input value={routerName} onChange={(e) => setRouterName(e.target.value)} placeholder="e.g. Shop Branch" />
        <button className="cta" onClick={addRouter}>Add router</button>
      </main>

      <main className="card">
        <h2>Your packages</h2>
        {data.packages.map((p) => (
          <div className="row" key={p.id}><span>{p.gb}GB</span><span>GHS {p.price_ghs}</span></div>
        ))}
        <label>GB</label>
        <input type="number" value={pkgGb} onChange={(e) => setPkgGb(e.target.value)} />
        <label>Price (GHS)</label>
        <input type="number" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
        <button className="cta" onClick={addPackage}>Add package</button>
      </main>

      <main className="card">
        <h2>Generate voucher codes</h2>
        <label>Router</label>
        <select value={genRouter} onChange={(e) => setGenRouter(e.target.value)}>
          <option value="">Choose router</option>
          {data.routers.map((r) => <option key={r.id} value={r.id}>{r.router_name}</option>)}
        </select>
        <label>Package (GB)</label>
        <select value={genGb} onChange={(e) => setGenGb(e.target.value)}>
          <option value="">Choose package</option>
          {data.packages.map((p) => <option key={p.id} value={p.gb}>{p.gb}GB - GHS {p.price_ghs}</option>)}
        </select>
        <label>How many codes</label>
        <input type="number" value={genCount} onChange={(e) => setGenCount(e.target.value)} />
        <button className="cta" onClick={generate}>Generate</button>
        {genResult?.codes && (
          <div className="note" style={{ textAlign: "left", marginTop: 10 }}>
            {genResult.codes.map((c) => <div key={c}><code>{c}</code></div>)}
          </div>
        )}
        {genResult?.error && <div className="err">{genResult.error}</div>}
      </main>

      <main className="card">
        <h2>Connect Paystack</h2>
        <div className="sub">Your WiFi customers' payments go straight to this Paystack account - Monibright never touches the money.</div>
        <label>Paystack Secret Key</label>
        <input type="password" value={paystackKey} onChange={(e) => setPaystackKey(e.target.value)} placeholder="sk_live_... or sk_test_..." />
        <button className="cta" onClick={saveSettings}>Save</button>
        {settingsMsg ? <div className="note">{settingsMsg}</div> : null}
        <div className="note" style={{ marginTop: 10 }}>
          Status: {data.tenant.has_paystack ? "\u2705 Connected" : "\u274c Not connected yet"}
        </div>
      </main>

      <main className="card">
        <h2>Your customer payment link</h2>
        <div className="sub">Put this link (or a button to it) on your WiFi login page.</div>
        <input readOnly value={typeof window !== "undefined" ? `${window.location.origin}/buy?t=${data.tenantId}` : ""} onClick={(e) => e.target.select()} />
      </main>

      <main className="card">
        <h2>Recent sales</h2>
        {data.sales.length === 0 ? <div className="note">No sales yet.</div> : data.sales.map((s, i) => (
          <div className="row" key={i}><span>{s.gb}GB - GHS {s.ghs}</span><span>{new Date(s.created_at).toLocaleDateString()}</span></div>
        ))}
      </main>
    </>
  );
}
