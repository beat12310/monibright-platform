"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    const d = await r.json();
    if (d.error) { setErr(d.error); setBusy(false); return; }
    router.push("/dashboard");
  }

  return (
    <main className="card">
      <h2>Create your account</h2>
      <div className="sub">Free to start. Pay only once your first router is set up.</div>
      <label>Business name</label>
      <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Kofi's WiFi" />
      <label>Email</label>
      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label>Password</label>
      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6+ characters" />
      <button className="cta" onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
      {err ? <div className="err">{err}</div> : null}
      <div className="note">Already have an account? <a href="/login">Log in</a></div>
    </main>
  );
}
