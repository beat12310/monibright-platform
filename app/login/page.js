"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Platform owners land on the admin overview, everyone else on their own
  // dashboard. The check is deliberately forgiving: if it errors, times out or
  // returns anything other than a clear yes, the user goes to /dashboard - the
  // behaviour this page has always had.
  async function goToRightPlace() {
    try {
      const a = await fetch("/api/admin", { cache: "no-store" });
      if (a.ok) { window.location.href = "/admin"; return; }
    } catch (e) {
      // ignore and fall through
    }
    router.push("/dashboard");
  }

  async function submit() {
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    const d = await r.json();
    if (d.error) { setErr(d.error); setBusy(false); return; }
    await goToRightPlace();
  }

  return (
    <main className="card">
      <h2>Log in</h2>
      <label>Email</label>
      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label>Password</label>
      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="cta" onClick={submit} disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      {err ? <div className="err">{err}</div> : null}
      <div className="note">New here? <a href="/signup">Create an account</a></div>
    </main>
  );
}
