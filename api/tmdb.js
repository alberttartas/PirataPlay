import { TMDB_KEY } from "./_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!TMDB_KEY)
    return res.status(503).json({ error: "TMDB_API_KEY não configurada." });

  const { query, type = "movie" } = req.query;
  if (!query) return res.status(400).json({ error: "Parâmetro 'query' obrigatório." });

  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
    );
    return res.status(200).json(await r.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
