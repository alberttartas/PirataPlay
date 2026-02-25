import { getCredsFromRequest } from "./_session.js";

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
    const timer = setTimeout(() => controller.abort(), 20000);

    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Range: req.headers["range"] || "",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"].forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    res.status(upstream.status);
    const reader = upstream.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      await pump();
    };
    await pump();
  } catch (err) {
    if (!res.headersSent) res.status(502).send("Proxy error: " + err.message);
  }
}
