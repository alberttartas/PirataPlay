import fetch from "node-fetch";
import { getCredsFromRequest, cachedFetch } from "../_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const creds = getCredsFromRequest(req);
  if (!creds) return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });

  const { type } = req.query;
  const actionMap = {
    vod:    "get_vod_categories",
    series: "get_series_categories",
    live:   "get_live_categories",
  };

  const action = actionMap[type];
  if (!action) return res.status(400).json({ error: "Tipo inválido. Use: vod, series ou live" });

  const { host, username, password } = creds;

  try {
    const url = `${host}/player_api.php?username=${username}&password=${password}&action=${action}`;
    const data = await cachedFetch(`cats_${type}_${username}`, () =>
      fetch(url, { signal: AbortSignal.timeout(10000) }).then(r => r.json())
    );
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
