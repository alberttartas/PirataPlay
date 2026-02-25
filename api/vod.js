import { getCredsFromRequest, cachedFetch, TMDB_KEY } from "./_session.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const creds = getCredsFromRequest(req);
  if (!creds) return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });

  const { host, username, password } = creds;
  const { category_id, page = 1, limit = 40 } = req.query;

  try {
    let url = `${host}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;
    if (category_id) url += `&category_id=${category_id}`;

    const allMovies = await cachedFetch(`vod_${username}_${category_id || "all"}`, () =>
      fetch(url).then(r => r.json())
    );

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(80, Math.max(1, Number(limit)));
    const start    = (pageNum - 1) * limitNum;
    const slice    = allMovies.slice(start, start + limitNum);

    if (TMDB_KEY && slice.length) {
      await Promise.allSettled(
        slice.map(async movie => {
          if (movie.backdrop || movie.poster) return;
          try {
            const r = await fetch(
              `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(movie.name)}&language=pt-BR`
            );
            const data = await r.json();
            const result = data.results?.[0];
            if (result) {
              movie.backdrop = result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : null;
              movie.poster   = result.poster_path   ? `https://image.tmdb.org/t/p/w500${result.poster_path}`   : null;
              movie.overview = result.overview || "";
              movie.rating   = result.vote_average;
              movie.year     = result.release_date?.slice(0, 4) || "";
            }
          } catch {}
        })
      );
    }

    return res.status(200).json({
      movies: slice,
      total:  allMovies.length,
      page:   pageNum,
      limit:  limitNum,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
