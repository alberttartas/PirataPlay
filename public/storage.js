// ══════════════════════════════════════
// STORAGE — PirataPlay
// Centraliza todo acesso ao localStorage
// ══════════════════════════════════════

const KEYS = {
  LOGIN:     "pp_login",
  SESSION:   "pp_session_token",
  PROGRESS:  "pp_progress_",
  FAVORITES: "pp_favorites",
  HISTORY:   "pp_history",
};

// ── Login ──────────────────────────────
function saveLogin(data) {
  try { localStorage.setItem(KEYS.LOGIN, JSON.stringify(data)); } catch {}
}
function getLogin() {
  try { return JSON.parse(localStorage.getItem(KEYS.LOGIN)); } catch { return null; }
}
function clearLogin() {
  localStorage.removeItem(KEYS.LOGIN);
  localStorage.removeItem(KEYS.SESSION);
}

// ── Session token ──────────────────────
function saveToken(token) {
  try { localStorage.setItem(KEYS.SESSION, token); } catch {}
}
function getToken() {
  return localStorage.getItem(KEYS.SESSION) || "";
}

// ── Progresso de vídeo ─────────────────
function saveProgress(id, time) {
  if (!id) return;
  try {
    const all = getAllProgress();
    all[id] = { time, updatedAt: Date.now() };
    // Mantém últimos 100 itens
    const keys = Object.keys(all);
    if (keys.length > 100) {
      const sorted = keys.sort((a, b) => (all[a].updatedAt || 0) - (all[b].updatedAt || 0));
      sorted.slice(0, keys.length - 100).forEach(k => delete all[k]);
    }
    localStorage.setItem(KEYS.PROGRESS + "all", JSON.stringify(all));
  } catch {}
}
function getProgress(id) {
  if (!id) return 0;
  try {
    const all = getAllProgress();
    return all[id]?.time || 0;
  } catch { return 0; }
}
function getAllProgress() {
  try { return JSON.parse(localStorage.getItem(KEYS.PROGRESS + "all")) || {}; } catch { return {}; }
}

// ── Favoritos ──────────────────────────
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(KEYS.FAVORITES)) || []; } catch { return []; }
}
function saveFavorites(list) {
  try { localStorage.setItem(KEYS.FAVORITES, JSON.stringify(list)); } catch {}
}
function isFavorite(id) {
  return getFavorites().some(f => String(f.id) === String(id));
}
function toggleFavorite(item) {
  const favs = getFavorites();
  const idx = favs.findIndex(f => String(f.id) === String(item.id));
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift({ ...item, savedAt: Date.now() });
    if (favs.length > 200) favs.pop();
  }
  saveFavorites(favs);
  return idx < 0; // true = foi adicionado
}

// ── Histórico de assistidos ────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.HISTORY)) || []; } catch { return []; }
}
function addToHistory(item) {
  try {
    const hist = getHistory().filter(h => String(h.id) !== String(item.id));
    hist.unshift({ ...item, watchedAt: Date.now() });
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(hist.slice(0, 20)));
  } catch {}
}
