import fetch from "node-fetch";
import { TMDB_KEY } from "./_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!TMDB_KEY)
    return res.status(503).json({ error: "TMDB_API_KEY não configurada no servidor." });

  const { query, type = "movie" } = req.query;
  if (!query) return res.status(400).json({ error: "Parâmetro 'query' obrigatório." });

  const validTypes = ["movie", "tv", "multi"];
  if (!validTypes.includes(type))
    return res.status(400).json({ error: "Tipo inválido. Use: movie, tv ou multi" });

  try {
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
