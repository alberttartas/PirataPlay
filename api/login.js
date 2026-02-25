import fetch from "node-fetch";
import { makeToken } from "./_session.js";

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { host, username, password } = req.body || {};
  if (!host || !username || !password)
    return res.status(400).json({ error: "Campos obrigatórios: host, username, password" });

  const cleanHost = host.replace(/\/$/, "");

  try {
    const url = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) throw new Error(`Servidor IPTV retornou ${response.status}`);

    const data = await response.json();

    if (!data.user_info || data.user_info.auth !== 1) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    // Token = credenciais em base64 (stateless — funciona bem no serverless)
    const token = makeToken({ host: cleanHost, username, password });

    return res.status(200).json({
      success: true,
      token,
      userInfo: {
        status:            data.user_info.status,
        expiryDate:        data.user_info.exp_date,
        maxConnections:    data.user_info.max_connections,
        activeConnections: data.user_info.active_cons,
      },
    });
  } catch (err) {
    if (err.name === "TimeoutError")
      return res.status(504).json({ error: "Servidor IPTV não respondeu (timeout)." });
    return res.status(502).json({ error: "Erro ao conectar: " + err.message });
  }
}
