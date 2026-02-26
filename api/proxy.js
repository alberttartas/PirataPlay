export const config = {
  runtime: "edge", // Edge Function — sem limite de tamanho, ideal para streams
};

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-session-token",
      },
    });
  }

  const { searchParams } = new URL(req.url);
  const url   = searchParams.get("url");
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Sessão inválida.", { status: 401 });
  }

  // Valida token (base64url → JSON)
  try {
    const json = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    JSON.parse(json); // só valida se é JSON válido
  } catch {
    return new Response("Token inválido.", { status: 401 });
  }

  if (!url) {
    return new Response("Parâmetro 'url' obrigatório.", { status: 400 });
  }

  const decoded = decodeURIComponent(url);
  if (!/^https?:\/\//i.test(decoded)) {
    return new Response("Somente HTTP(S) suportado.", { status: 400 });
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PirataPlay/2.0)",
        "Range":      req.headers.get("range") || "",
      },
    });

    // Detecta content-type correto
    let contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (decoded.endsWith(".ts"))   contentType = "video/mp2t";
    if (decoded.includes(".m3u8")) contentType = "application/vnd.apple.mpegurl";

    // Monta headers de resposta
    const headers = new Headers({
      "Content-Type":                contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "no-cache",
    });

    // Repassa headers de range se existirem
    ["content-length", "content-range", "accept-ranges"].forEach(h => {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    });

    // Faz streaming real — Edge Functions suportam ReadableStream sem limite
    return new Response(upstream.body, {
      status:  upstream.status,
      headers,
    });

  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 502 });
  }
}
