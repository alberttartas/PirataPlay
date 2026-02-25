// Token = credenciais em base64 (stateless, funciona no serverless)
export function makeToken(creds) {
  const json = JSON.stringify(creds);
  return Buffer.from(json).toString("base64url");
}

export function parseToken(token) {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getCredsFromRequest(req) {
  const token =
    req.headers["x-session-token"] ||
    req.query?.token ||
    "";
  return parseToken(token);
}

// Cache simples em memória
const _cache = new Map();
export function cachedFetch(key, fn, ttlMs = 5 * 60 * 1000) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then(data => {
    _cache.set(key, { data, ts: Date.now() });
    if (_cache.size > 50) {
      const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      _cache.delete(oldest[0]);
    }
    return data;
  });
}

export const TMDB_KEY = process.env.TMDB_API_KEY || "6862f118a59693b921840e5bbbdabb74";
