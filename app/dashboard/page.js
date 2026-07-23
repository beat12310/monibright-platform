"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);
  const [portal, setPortal] = useState(null);
  const [routerName, setRouterName] = useState("");
  const [pkgGb, setPkgGb] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [genRouter, setGenRouter] = useState("");
  const [genGb, setGenGb] = useState("");
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
  async function addPackage() { if (await post("/api/packages", { gb: Number(pkgGb), priceGhs: Number(pkgPrice) })) { setPkgGb(""); setPkgPrice(""); load(); } }
  async function generate() { const d = await post("/api/vouchers", { routerId: genRouter, gb: Number(genGb), count: Number(genCount) }); if (d) setGenResult(d); }
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
