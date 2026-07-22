import Link from "next/link";
export default function Home() {
  return (
    <main className="card" style={{ textAlign: "center" }}>
      <h1>Sell WiFi with your own brand</h1>
      <p className="sub">Turn your MikroTik router into a paid WiFi business. Your branding, your prices, your Paystack account.</p>
      <Link href="/signup"><button className="cta">Get started free</button></Link>
      <Link href="/login"><button className="cta ghost" style={{ marginTop: 8 }}>I already have an account</button></Link>
    </main>
  );
}
