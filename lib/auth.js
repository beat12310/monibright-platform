import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(tenantId) {
  return jwt.sign({ tenantId }, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
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
