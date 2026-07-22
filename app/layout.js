import "./globals.css";
export const metadata = { title: "Monibright Platform", description: "Sell WiFi with your own brand" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="brand"><div className="m">M</div><h1 style={{ color: "#fff" }}>Monibright Platform</h1></div>
          {children}
        </div>
      </body>
    </html>
  );
}
