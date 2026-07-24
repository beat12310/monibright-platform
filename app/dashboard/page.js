"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);
  const [portal, setPortal] = useState(null);
  const [routerName, setRouterName] = useState("");
  const [pkgType, setPkgType] = useState("data");
  const [pkgGb, setPkgGb] = useState("");
  const [pkgDays, setPkgDays] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [genRouter, setGenRouter] = useState("");
  const [genPackage, setGenPackage] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [genResult, setGenResult] = useState(null);
  const [paystackKey, setPaystackKey] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [portalMsg, setPortalMsg] = useState("");
  const [billMsg, setBillMsg] = useState("");
  const [apiErr, setApiErr] = useState("");
  const [tenantId, setTenantId] = useState(null);

  async function load() {
    const r = await fetch("/api/dashboard");
    if (r.status === 401) { window.location.href = "/login"; return; }
    const d = await r.json();
    setData(d);
    setTenantId(d?.tenant?.id ?? null);
    const b = await fetch("/api/billing").then(x => x.json()).catch(() => null);
    setBilling(b?.status || null);
    const p = await fetch("/api/portal").then(x => x.json()).catch(() => null);
    if (p?.portal) setPortal(p.portal);
  }
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("billing") === "success") setBillMsg("Payment received - your subscription is extended. Thank you!");
    if (q.get("billing") === "failed") setBillMsg("Payment was not completed. Nothing was charged - try again.");
  }, []);

  async function post(url, body) {
    setApiErr("");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setApiErr(d.error || "Something went wrong."); return null; }
    return d;
  }

  async function addRouter() { if (await post("/api/routers", { routerName })) { setRouterName(""); load(); } }
  async function addPackage() {
    const body = pkgType === "time"
      ? { type: "time", days: Number(pkgDays), priceGhs: Number(pkgPrice) }
      : { type: "data", gb: Number(pkgGb), priceGhs: Number(pkgPrice) };
    if (await post("/api/packages", body)) { setPkgGb(""); setPkgDays(""); setPkgPrice(""); load(); }
  }
  async function generate() { const d = await post("/api/vouchers", { routerId: genRouter, packageId: genPackage, count: Number(genCount) }); if (d) setGenResult(d); }
  async function saveSettings() {
    setSettingsMsg("Checking key with Paystack...");
    const d = await post("/api/settings", { paystackSecretKey: paystackKey });
    setSettingsMsg(d ? "Key verified and saved. Customer payments now go to your Paystack." : "");
    if (d) { setPaystackKey(""); load(); }
  }
  async function savePortal() {
    setPortalMsg("Saving...");
    const d = await post("/api/portal", { brandColor: portal.brand_color, welcome: portal.portal_welcome, logoUrl: portal.portal_logo_url, supportPhone: portal.support_phone });
    setPortalMsg(d ? "Saved!" : "");
  }
  async function payFor(plan) {
    setBillMsg("Opening secure Paystack payment...");
    const d = await post("/api/billing", { plan });
    if (d?.url) window.location.href = d.url;
  }

  if (!data) return <main className="card">Loading...</main>;
  if (data.error) return <main className="card err">{data.error}</main>;

  const expired = billing && !billing.active;

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

      {apiErr && <main className="card" style={{ background: "#fff3f3", color: "#b00020" }}>{apiErr}</main>}

      <main className="card">
        <h2>Your plan</h2>
        {billing ? (
          <>
            <p style={{ margin: "4px 0 10px" }}>
              <b>{billing.label}</b>{" - "}
              {billing.active
                ? <>{billing.daysLeft} day{billing.daysLeft === 1 ? "" : "s"} left{billing.plan === "trial" ? " in your free trial" : ""}</>
                : <span style={{ color: "#b00020", fontWeight: 700 }}>EXPIRED - renew to keep selling</span>}
              {" · "}up to {billing.routerLimit} router{billing.routerLimit === 1 ? "" : "s"}
            </p>
            <div className="stat-row">
              <div className="stat">
                <div className="v">GHS 120<span style={{ fontSize: 12 }}>/mo</span></div>
                <div className="l">Basic - 1 router</div>
                <button className="cta" style={{ marginTop: 8 }} onClick={() => payFor("basic")}>
                  {billing.plan === "basic" && billing.active ? "Renew 30 days" : "Choose Basic"}
                </button>
              </div>
              <div className="stat">
                <div className="v">GHS 250<span style={{ fontSize: 12 }}>/mo</span></div>
                <div className="l">Pro - up to 3 routers</div>
                <button className="cta" style={{ marginTop: 8 }} onClick={() => payFor("pro")}>
                  {billing.plan === "pro" && billing.active ? "Renew 30 days" : "Choose Pro"}
                </button>
              </div>
            </div>
            {billMsg && <p style={{ marginTop: 10 }}>{billMsg}</p>}
          </>
        ) : <p>Loading plan...</p>}
      </main>

      <main className="card">
        <h2>Your routers</h2>
        {expired && <p style={{ color: "#b00020" }}>Subscription expired - renew above to manage routers.</p>}
        {data.routers.map(r => (
          <div className="row" key={r.id}>
            <span>{r.router_name} <span className="pill">{r.router_key}</span></span>
            <button className="cta ghost" style={{ width: "auto", padding: "6px 12px", margin: 0 }}
              onClick={() => { window.location.href = `/api/script?routerId=${r.id}`; }}>
              Download setup script
            </button>
          </div>
        ))}
        <div style={{ background: "#f4f7ff", borderRadius: 10, padding: "10px 12px", fontSize: 13, margin: "10px 0" }}>
          <b>How to set up a router (5 minutes):</b>
          <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>Plug your internet cable into port 1, your computer into port 2.</li>
            <li>Open <b>http://192.168.88.1</b>, log in, open <b>Terminal</b>.</li>
            <li>Download the setup script above - it opens like a normal text file. Copy ALL of it, paste into the terminal, press Enter.</li>
            <li>Done. Your admin page moves to <b>http://192.168.88.1:8080</b> (save that link). The WiFi opens with your business name, and customers need a voucher code to get online.</li>
          </ol>
        </div>
        <label>New router name</label>
        <input value={routerName} onChange={e => setRouterName(e.target.value)} placeholder="e.g. Shop Branch" />
        <button className="cta" onClick={addRouter}>Add router</button>
      </main>

      <main className="card">
        <h2>Your packages</h2>
        {data.packages.map(p => (
          <div className="row" key={p.id}>
            <span>{p.type === "time" ? `${p.days} day${p.days === 1 ? "" : "s"} - unlimited data` : `${p.gb}GB`}</span>
            <span>GHS {Number(p.price_ghs).toFixed(2)}</span>
          </div>
        ))}
        <label>Package type</label>
        <select value={pkgType} onChange={e => setPkgType(e.target.value)}>
          <option value="data">Data amount (e.g. 1GB)</option>
          <option value="time">Time pass - unlimited data (e.g. 1 day)</option>
        </select>
        {pkgType === "time" ? (
          <>
            <label>Days</label>
            <input value={pkgDays} onChange={e => setPkgDays(e.target.value)} type="number" placeholder="e.g. 1" />
          </>
        ) : (
          <>
            <label>GB</label>
            <input value={pkgGb} onChange={e => setPkgGb(e.target.value)} type="number" placeholder="e.g. 1" />
          </>
        )}
        <label>Price (GHS)</label>
        <input value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} type="number" />
        <button className="cta" onClick={addPackage}>Add package</button>
      </main>

      <main className="card">
        <h2>Generate voucher codes</h2>
        <label>Router</label>
        <select value={genRouter} onChange={e => setGenRouter(e.target.value)}>
          <option value="">Choose router</option>
          {data.routers.map(r => <option key={r.id} value={r.id}>{r.router_name}</option>)}
        </select>
        <label>Package</label>
        <select value={genPackage} onChange={e => setGenPackage(e.target.value)}>
          <option value="">Choose package</option>
          {data.packages.map(p => (
            <option key={p.id} value={p.id}>
              {p.type === "time" ? `${p.days} day${p.days === 1 ? "" : "s"} - unlimited` : `${p.gb}GB`} - GHS {Number(p.price_ghs).toFixed(2)}
            </option>
          ))}
        </select>
        <label>How many codes</label>
        <input value={genCount} onChange={e => setGenCount(e.target.value)} type="number" />
        <button className="cta" onClick={generate}>Generate</button>
        {genResult?.codes && (
          <div style={{ marginTop: 10 }}>
            <p><b>{genResult.codes.length} codes</b> ({genResult.type === "time" ? `${genResult.days} day${genResult.days === 1 ? "" : "s"} unlimited` : `${genResult.gb}GB`} @ GHS {genResult.price} each). Customer enters the code as both username and password:</p>
            <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 8, fontSize: 14 }}>{genResult.codes.join("\n")}</pre>
          </div>
        )}
      </main>

      <main className="card">
        <h2>Design your WiFi login page</h2>
        <p style={{ fontSize: 13, color: "#666" }}>This is the page your customers see when they join your WiFi.</p>
        {portal && (
          <>
            <label>Welcome message</label>
            <input value={portal.portal_welcome} placeholder={`Welcome to ${data.tenant.business_name} WiFi`}
              onChange={e => setPortal({ ...portal, portal_welcome: e.target.value })} />
            <label>Brand color</label>
            <input type="color" value={portal.brand_color} style={{ height: 44, padding: 4 }}
              onChange={e => setPortal({ ...portal, brand_color: e.target.value })} />
            <label>Logo image URL (optional)</label>
            <input value={portal.portal_logo_url} placeholder="https://..." onChange={e => setPortal({ ...portal, portal_logo_url: e.target.value })} />
            <label>Support phone / WhatsApp (optional)</label>
            <input value={portal.support_phone} placeholder="e.g. 024 000 0000" onChange={e => setPortal({ ...portal, support_phone: e.target.value })} />

            <div style={{ margin: "14px 0", borderRadius: 12, padding: 20, background: portal.brand_color, textAlign: "center" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, maxWidth: 260, margin: "0 auto" }}>
                {portal.portal_logo_url ? <img src={portal.portal_logo_url} alt="" style={{ maxHeight: 40, marginBottom: 8 }} /> : null}
                <div style={{ fontWeight: 700 }}>{portal.portal_welcome || `Welcome to ${data.tenant.business_name} WiFi`}</div>
                <div style={{ fontSize: 12, color: "#666", margin: "6px 0" }}>Enter your voucher code to get online</div>
                <div style={{ border: "1.5px solid #ddd", borderRadius: 8, padding: 8, fontSize: 13, color: "#999" }}>Voucher code</div>
                <div style={{ background: portal.brand_color, color: "#fff", borderRadius: 8, padding: 9, marginTop: 8, fontWeight: 700, fontSize: 14 }}>Connect</div>
                {portal.support_phone ? <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>Need help? {portal.support_phone}</div> : null}
              </div>
            </div>

            <button className="cta" onClick={savePortal}>Save design</button>
            {portalMsg && <p>{portalMsg}</p>}
            <div style={{ background: "#f4f7ff", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginTop: 8 }}>
              <b>No upload needed.</b> New routers pick up this design automatically when you run their setup script. Already set up a router? After saving, paste these lines into its terminal to refresh it instantly:
              {data.routers.map(r => (
                <pre key={r.id} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: 8, fontSize: 12, marginTop: 6, overflowX: "auto" }}>
{`/tool fetch url="https://monibright-platform.vercel.app/api/portal/live?key=${r.router_key}" dst-path=hotspot/login.html
/tool fetch url="https://monibright-platform.vercel.app/api/portal/live?key=${r.router_key}&page=status" dst-path=hotspot/status.html
/interface wifi set [find] configuration.ssid="${(data.tenant.business_name + " WiFi").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 30)}" security.authentication-types=""`}
                </pre>
              ))}
            </div>
          </>
        )}
      </main>

      <main className="card">
        <h2>Connect Paystack</h2>
        <p style={{ fontSize: 13, color: "#666" }}>Your WiFi customers' payments go straight to <b>your</b> Paystack account - Monibright never touches the money.</p>
        <p style={{ fontSize: 13 }}>Status: {data.tenant.has_paystack ? "✅ Connected - customers can buy codes with MoMo" : "❌ Not connected yet"}</p>
        <label>Paystack secret key (starts with sk_live_)</label>
        <input value={paystackKey} onChange={e => setPaystackKey(e.target.value)} placeholder="sk_live_..." />
        <button className="cta" onClick={saveSettings}>{data.tenant.has_paystack ? "Update key" : "Connect Paystack"}</button>
        {settingsMsg && <p>{settingsMsg}</p>}
        <p style={{ fontSize: 12, color: "#888" }}>Find it in your Paystack dashboard: Settings &rarr; API Keys &amp; Webhooks. Use the SECRET key, not the public key.</p>
        {tenantId ? (
          <>
            <label>Your customer payment link</label>
            <input readOnly value={`https://monibright-platform.vercel.app/buy?tenantId=${tenantId}`} onFocus={e => e.target.select()} />
            <p style={{ fontSize: 12, color: "#888" }}>This link is already built into your WiFi login page ("Buy a code with MoMo").</p>
          </>
        ) : null}
      </main>

      <main className="card">
        <h2>Recent sales</h2>
        {data.sales.length === 0 ? <p>No sales yet.</p> : data.sales.map((s, i) => (
          <div className="row" key={i}><span>{s.days ? `${s.days}d unlimited` : `${s.gb}GB`} - {s.code}</span><span>GHS {Number(s.amount_ghs ?? s.ghs).toFixed(2)}</span></div>
        ))}
      </main>
    </>
  );
}
