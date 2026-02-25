import { getCredsFromRequest, cachedFetch } from "../_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const creds = getCredsFromRequest(req);
  if (!creds) return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });

  const { host, username, password } = creds;
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "ID inválido." });

  try {
    const url = `${host}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${id}`;
    const data = await cachedFetch(`series_info_${id}_${username}`, () =>
      fetch(url).then(r => r.json())
    );
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
