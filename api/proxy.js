import fetch from "node-fetch";
import { getCredsFromRequest } from "./_session.js";

export const config = {
  api: {
    responseLimit: false,  // sem limite de tamanho de resposta (necessário para streams)
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
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PirataPlay/2.0)",
        Range: req.headers["range"] || "",
        Referer: "",
      },
      signal: AbortSignal.timeout(20000),
    });

    // Repassa headers relevantes
    ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"].forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    res.status(upstream.status);
    upstream.body.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(502).send("Proxy error: " + err.message);
  }
}
