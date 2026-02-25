import { getCredsFromRequest } from "./_session.js";
import { Readable } from "stream";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const creds = getCredsFromRequest(req);
  if (!creds) return res.status(401).send("Sessão inválida.");

  const { url } = req.query;
  if (!url) return res.status(400).send("Parâmetro 'url' obrigatório.");

  const decoded = decodeURIComponent(url);
  if (!/^https?:\/\//i.test(decoded))
    return res.status(400).send("Somente URLs HTTP(S) são suportadas.");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent":  "Mozilla/5.0 (compatible; PirataPlay/2.0)",
        "Range":       req.headers["range"] || "",
        "Connection":  "keep-alive",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Detecta tipo do stream
    const isTs  = decoded.includes(".ts");
    const isM3u = decoded.includes(".m3u8") || decoded.includes(".m3u");

    // Content-Type correto por tipo
    if (isTs) {
      res.setHeader("Content-Type", "video/mp2t");
    } else if (isM3u) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    } else {
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("Content-Type", ct);
    }

    // Repassa outros headers úteis
    ["content-length", "content-range", "accept-ranges", "cache-control"].forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(upstream.status);

    // Pipe do stream
    Readable.fromWeb(upstream.body).pipe(res);

  } catch (err) {
    if (!res.headersSent) res.status(502).send("Proxy error: " + err.message);
  }
}
