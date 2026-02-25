import { getCredsFromRequest, cachedFetch } from "./_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const creds = getCredsFromRequest(req);
  if (!creds) return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });

  const { host, username, password } = creds;
  const { category_id } = req.query;

  try {
    let url = `${host}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
    if (category_id) url += `&category_id=${category_id}`;

    const data = await cachedFetch(`live_${username}_${category_id || "all"}`, () =>
      fetch(url).then(r => r.json())
    );
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
