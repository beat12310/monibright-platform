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
  const [accountEmail, setAccountEmail] = useState("");
  const [accountMsg, setAccountMsg] = useState("");
  const [wifiNames, setWifiNames] = useState({});
  const [routerMsg, setRouterMsg] = useState("");
  const [businessName, setBusinessName] = useState("");

  async function load() {
    const r = await fetch("/api/dashboard");
    if (r.status === 401) { window.location.href = "/login"; return; }
    const d = await r.json();
    setData(d);
    setTenantId(d?.tenant?.id ?? null);
    setAccountEmail(d?.tenant?.email ?? "");
    setBusinessName(d?.tenant?.business_name ?? "");
    setWifiNames(Object.fromEntries((d?.routers || []).map(x => [x.id, x.router_name || ""])));
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

  async function patch(url, body) {
    setApiErr("");
    const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setApiErr(d.error || "Something went wrong."); return null; }
    return d;
  }

  async function del(url) {
    setApiErr("");
    const r = await fetch(url, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setApiErr(d.error || "Something went wrong."); return null; }
    return d;
  }

  async function addRouter() { if (await post("/api/routers", { routerName })) { setRouterName(""); load(); } }

  async function saveWifiName(r) {
    const name = (wifiNames[r.id] || "").trim();
    if (!name) { setRouterMsg("Enter a WiFi name first."); return; }
    if (name === r.router_name) { setRouterMsg("That is already the WiFi name."); return; }
    setRouterMsg("Saving...");
    const d = await patch(`/api/routers?routerId=${r.id}`, { routerName: name });
    if (!d) { setRouterMsg(""); return; }
    setRouterMsg(
      (d.cleaned ? `Saved as "${d.router.router_name}" (some characters aren't allowed in a WiFi name). ` : "Saved. ") +
      "The router will switch to the new name within about 2 minutes. Phones already connected will need to rejoin."
    );
    load();
  }

  async function removeRouter(r) {
    const sure = window.confirm(
      `Remove "${r.router_name}"?\n\n` +
      `Its captive portal (key ${r.router_key}) will stop working straight away. ` +
      `You will need to run a fresh setup script on that router before it can sell WiFi again.\n\n` +
      `This cannot be undone.`
    );
    if (!sure) return;
    if (await del(`/api/routers?routerId=${r.id}`)) load();
  }

  async function signOut() {
    const sure = window.confirm("Sign out of Monibright on this device?");
    if (!sure) return;
    await fetch("/api/auth/login", { method: "DELETE" }).catch(() => {});
    window.location.href = "/login";
  }

  async function saveBusinessName() {
    const clean = businessName.trim();
    if (!clean) { setAccountMsg("Enter a business name."); return; }
    if (clean === (data?.tenant?.business_name || "")) { setAccountMsg("That is already your business name."); return; }
    setAccountMsg("Saving...");
    const d = await post("/api/settings", { businessName: clean });
    setAccountMsg(d ? `Saved. Your WiFi pages will show "${d.businessName}" within about 2 minutes.` : "");
    if (d) load();
  }

  async function saveEmail() {
    const clean = accountEmail.trim().toLowerCase();
    if (!clean) { setAccountMsg("Enter an email address first."); return; }
    if (clean === (data?.tenant?.email || "")) { setAccountMsg("That is already your email address."); return; }
    const sure = window.confirm(
      `Change your sign-in email to:\n\n${clean}\n\n` +
      `From now on you log in with this address and your existing password. ` +
      `Make sure you can receive mail here.`
    );
    if (!sure) return;
    setAccountMsg("Saving...");
    const d = await post("/api/settings", { email: clean });
    setAccountMsg(d ? `Saved. Sign in with ${d.email} from now on - your password has not changed.` : "");
    if (d) load();
  }

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
    setPortalMsg(d ? "Saved! Your routers will pick up the new design within about 2 minutes." : "");
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
        <h2>Your account</h2>

        <label>Business name</label>
        <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Richie One" />
        <button className="cta" onClick={saveBusinessName}>Save business name</button>
        <p style={{ fontSize: 12, color: "#888" }}>
          Shown on the WiFi login page and on the &quot;you&apos;re connected&quot; page your customers see.
        </p>

        <p style={{ fontSize: 13, color: "#666", marginTop: 18 }}>This is the email address you sign in with.</p>
        <label>Email address</label>
        <input value={accountEmail} onChange={e => setAccountEmail(e.target.value)} type="email" placeholder="you@example.com" />
        <button className="cta" onClick={saveEmail}>Save email</button>
        {accountMsg && <p>{accountMsg}</p>}
        <p style={{ fontSize: 12, color: "#888" }}>
          Your password stays the same. There is no confirmation email, so double-check the spelling before you save.
        </p>

        <button className="cta ghost" style={{ marginTop: 18 }} onClick={signOut}>Sign out</button>
      </main>

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
        <h2>Your WiFi networks</h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          Type a new name and save. The router changes its WiFi name by itself - you do not need to touch it.
        </p>
        {expired && <p style={{ color: "#b00020" }}>Subscription expired - renew above to manage routers.</p>}

        {data.routers.length === 0 && <p>No routers yet. Add one below.</p>}

        {data.routers.map(r => (
          <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
            <label>WiFi name</label>
            <input
              value={wifiNames[r.id] ?? ""}
              onChange={e => setWifiNames({ ...wifiNames, [r.id]: e.target.value })}
              placeholder="e.g. Kojo Shop WiFi"
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button className="cta" style={{ width: "auto", padding: "8px 14px", margin: 0 }}
                onClick={() => saveWifiName(r)}>
                Save WiFi name
              </button>
              <button className="cta ghost" style={{ width: "auto", padding: "8px 14px", margin: 0 }}
                onClick={() => { window.location.href = `/api/script?routerId=${r.id}`; }}>
                Download setup script
              </button>
              <button className="cta ghost" style={{ width: "auto", padding: "8px 14px", margin: 0, color: "#b00020", borderColor: "#b00020" }}
                onClick={() => removeRouter(r)}>
                Remove
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0" }}>
              Router key <span className="pill">{r.router_key}</span>
            </p>
          </div>
        ))}

        {routerMsg && <p style={{ marginTop: 10 }}>{routerMsg}</p>}

        <div style={{ background: "#f4f7ff", borderRadius: 10, padding: "10px 12px", fontSize: 13, margin: "14px 0" }}>
          <b>Setting up a router for the first time (5 minutes):</b>
          <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>Plug your internet cable into <b>port 1</b>, your computer into <b>port 2</b>.</li>
            <li>Open <b>http://192.168.88.1</b> and log in. On a brand new router the name is <b>admin</b> and the password is blank.</li>
            <li>Click <b>Terminal</b> (top right of the router page).</li>
            <li><b>Unlock the router first</b> - paste this one line and press Enter:
              <pre style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: 8, fontSize: 12, marginTop: 6, overflowX: "auto" }}>/system device-mode update fetch=yes scheduler=yes proxy=yes</pre>
              It will ask you to prove someone is really there. <b>Tap the router&apos;s reset button for about 1 second</b> - a quick tap, NOT a long hold (holding it erases the router). The router restarts, then log in again.
            </li>
            <li>Download the setup script above - it opens like a normal text file. Copy ALL of it, paste into Terminal, press Enter.</li>
            <li>Done. Your admin page moves to <b>http://192.168.88.1:8080</b> - save that link. From now on you change everything from this website and the router follows on its own.</li>
          </ol>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#a15c00" }}>
            <b>Why step 4 matters.</b> Every MikroTik leaves the factory locked down. Without it you may see <i>&quot;not allowed by device-mode&quot;</i>, and worse, the router will look like it worked but will quietly never pick up changes you make here - the WiFi name, the phone number, the design. If you skip it you have to come back to the router in person to change anything.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#888" }}>
            To check a router later, paste <code>/system device-mode print</code> in Terminal. You want <b>fetch: yes</b>, <b>scheduler: yes</b> and <b>proxy: yes</b>.
          </p>
        </div>

        <label>Add another router</label>
        <input value={routerName} onChange={e => setRouterName(e.target.value)} placeholder="e.g. Shop Branch WiFi" />
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
            <p style={{ fontSize: 12, color: "#888" }}>
              Nothing to upload and nothing to paste. Every router you have set up checks for changes on its own.
            </p>
          </>
        )}
      </main>

      <main className="card">
        <h2>Connect Paystack</h2>
        <p style={{ fontSize: 13, color: "#666" }}>Your WiFi customers&apos; payments go straight to <b>your</b> Paystack account - Monibright never touches the money.</p>
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
            <p style={{ fontSize: 12, color: "#888" }}>This link is already built into your WiFi login page (&quot;Buy a code with MoMo&quot;).</p>
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
