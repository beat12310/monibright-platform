"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Collect() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const tenantId = params.get("tenantId");
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!reference || !tenantId) { setState({ error: "Missing payment details." }); return; }
    fetch(`/api/verify?reference=${encodeURIComponent(reference)}&tenantId=${tenantId}`)
      .then((r) => r.json())
      .then((d) => setState(d.code ? d : { error: d.error }))
      .catch(() => setState({ error: "Network problem, refresh this page." }));
  }, [reference, tenantId]);

  if (state.loading) return <main className="card">Confirming payment...</main>;
  if (state.error) return <main className="card err">{state.error}</main>;
  return (
    <main className="card" style={{ textAlign: "center" }}>
      <h2>Payment successful - {state.gb}GB</h2>
      <div className="stat"><div className="v"><code>{state.code}</code></div><div className="l">Your voucher code</div></div>
      <div className="note">Enter this code on the WiFi login page.</div>
    </main>
  );
}
export default function CollectPage() {
  return <Suspense fallback={<main className="card">Loading...</main>}><Collect /></Suspense>;
}
