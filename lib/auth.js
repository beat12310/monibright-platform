import jwt from "jsonwebtoken";

// No hardcoded fallback on purpose.
// The old code fell back to the literal string "dev-secret-change-me" when
// JWT_SECRET was missing. Anyone who could read that line could mint a valid
// session cookie for any account. If the variable is ever missing now, logins
// fail loudly instead of silently becoming forgeable.
function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET is not set. Add it in Vercel > Settings > Environment Variables, then redeploy.");
  }
  return s;
}

export function signToken(tenantId) {
  return jwt.sign({ tenantId }, secret(), { expiresIn: "30d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

export function getTenantIdFromRequest(req) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/mb_session=([^;]+)/);
  if (!match) return null;
  const decoded = verifyToken(match[1]);
  return decoded?.tenantId || null;
}
