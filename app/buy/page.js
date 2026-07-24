"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Buy() {
  const params = useSearchParams();
  const tenantId = params.get("t") || params.get("tenantId");
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/packages?tenantId=${tenantId}`).then((r) => r.json()).then((d) => setPackages(d.packages || []));
  }, [tenantId]);

  async function pay() {
    setBusy(true); setErr("");
    const r = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, packageId }) });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else { setErr(d.error || "Could not start payment."); setBusy(false); }
  }

  if (!tenantId) return <main className="card err">Missing business ID in the link.</main>;

  return (
    <main className="card">
      <h2>Buy WiFi access with Mobile Money</h2>
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {packages.map((p) => (
          <div key={p.id} className="stat" style={{ cursor: "pointer", border: packageId === p.id ? "2px solid #f5a623" : "2px solid transparent" }} onClick={() => setPackageId(p.id)}>
            <div className="v">{p.type === "time" ? `${p.days} day${p.days === 1 ? "" : "s"}` : `${p.gb}GB`}</div>
            <div className="l">GHS {p.price_ghs}</div>
          </div>
        ))}
      </div>
      <button className="cta" onClick={pay} disabled={!packageId || busy}>{busy ? "Opening payment..." : "Pay with MoMo"}</button>
      {err ? <div className="err">{err}</div> : null}
    </main>
  );
}
export default function BuyPage() {
  return <Suspense fallback={<main className="card">Loading...</main>}><Buy /></Suspense>;
}
