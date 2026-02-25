// ══════════════════════════════════════
// APP.JS — PirataPlay v2
// ══════════════════════════════════════

// ── Estado global ──────────────────────
let hls = null;
let currentItem = null;
let currentTab  = "movies";
let currentPage = 1;
let allMovies   = [];
let allSeries   = [];
let allLive     = [];
let heroItem    = null;

// ── Helpers de requisição ──────────────
async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function showError(msg, target = "globalError") {
  const el = document.getElementById(target);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}

// ══════════════════════════════════════
// LOGIN
// ══════════════════════════════════════
async function login() {
  const host     = document.getElementById("host").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const remember = document.getElementById("rememberMe").checked;

  if (!host || !username || !password) {
    showError("Preencha todos os campos.", "loginError");
    return;
  }

  const btnText    = document.getElementById("loginBtnText");
  const btnSpinner = document.getElementById("loginSpinner");
  btnText.textContent = "Entrando...";
  btnSpinner.classList.remove("hidden");
  document.getElementById("btnLogin").disabled = true;

  try {
    const data = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, username, password }),
    }).then(async r => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      return json;
    });

    saveToken(data.token);
    if (remember) saveLogin({ host, username, password });

    showApp(data.userInfo);
    await loadAll();
  } catch (err) {
    showError(err.message, "loginError");
  } finally {
    btnText.textContent = "Entrar";
    btnSpinner.classList.add("hidden");
    document.getElementById("btnLogin").disabled = false;
  }
}

function logout() {
  clearLogin();
  if (hls) hls.destroy();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("host").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
}

function showApp(userInfo) {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  if (userInfo) {
    const exp = userInfo.expiryDate
      ? new Date(userInfo.expiryDate * 1000).toLocaleDateString("pt-BR")
      : "—";
    document.getElementById("userInfo").innerHTML = `
      <strong>${userInfo.status === "Active" ? "✅ Ativo" : "⚠️ " + userInfo.status}</strong><br/>
      Expira: ${exp}<br/>
      Conexões: ${userInfo.activeConnections}/${userInfo.maxConnections}
    `;
  }
}

// ── Auto-login ─────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  // Preenche campo se lembrou
  const saved = getLogin();
  if (saved) {
    document.getElementById("host").value     = saved.host || "";
    document.getElementById("username").value = saved.username || "";
    document.getElementById("password").value = saved.password || "";
    document.getElementById("rememberMe").checked = true;

    // Se tem token, tenta session existente
    const token = getToken();
    if (token) {
      try {
        showApp(null);
        await loadAll();
        return;
      } catch {
        // token expirado, mostra login normal
        document.getElementById("app").classList.add("hidden");
        document.getElementById("loginScreen").classList.remove("hidden");
      }
    }
  }

  // Enter no campo de senha dispara login
  document.getElementById("password").addEventListener("keydown", e => {
    if (e.key === "Enter") login();
  });
});

// ══════════════════════════════════════
// CARREGAMENTO INICIAL
// ══════════════════════════════════════
async function loadAll() {
  setLoader(true);
  try {
    await Promise.all([
      loadCategories("movies"),
      loadMovies(),
      loadSeries(),
      loadLive(),
    ]);
    renderContinueWatching();
    renderFavorites();
  } catch (err) {
    showError("Erro ao carregar conteúdo: " + err.message);
  } finally {
    setLoader(false);
  }
}

function setLoader(on) {
  document.getElementById("mainLoader").classList.toggle("hidden", !on);
}

// ══════════════════════════════════════
// CATEGORIAS
// ══════════════════════════════════════
async function loadCategories(type) {
  try {
    const cats = await api(`/api/categories/${type}`);
    const sel = document.getElementById("categoryFilter");
    sel.innerHTML = '<option value="">Todas categorias</option>';
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.category_id;
      opt.textContent = c.category_name;
      sel.appendChild(opt);
    });
  } catch {}
}

async function filterByCategory() {
  const catId = document.getElementById("categoryFilter").value;
  currentPage = 1;
  if (currentTab === "movies") await loadMovies(catId);
  else if (currentTab === "series") await loadSeries(catId);
  else if (currentTab === "live") await loadLive(catId);
}

// ══════════════════════════════════════
// FILMES
// ══════════════════════════════════════
async function loadMovies(categoryId = "", page = 1) {
  currentPage = page;
  setLoader(true);
  try {
    const params = new URLSearchParams({ page, limit: 40 });
    if (categoryId) params.set("category_id", categoryId);

    const data = await api(`/api/vod?${params}`);
    allMovies = data.movies;
    renderMovies(allMovies);
    renderPagination(data.total, data.page, data.limit, p => loadMovies(categoryId, p));
    setHero(allMovies);
  } catch (err) {
    showError("Erro ao carregar filmes: " + err.message);
  } finally {
    setLoader(false);
  }
}

function renderMovies(movies) {
  const grid = document.getElementById("moviesGrid");
  if (!movies.length) {
    grid.innerHTML = '<p class="empty-msg">Nenhum filme encontrado.</p>';
    return;
  }
  grid.innerHTML = movies.map(m => cardHTML(m, "movie")).join("");
}

// ══════════════════════════════════════
// SÉRIES
// ══════════════════════════════════════
async function loadSeries(categoryId = "") {
  setLoader(true);
  try {
    const params = categoryId ? `?category_id=${categoryId}` : "";
    allSeries = await api(`/api/series${params}`);
    renderSeriesGrid(allSeries);
  } catch (err) {
    showError("Erro ao carregar séries: " + err.message);
  } finally {
    setLoader(false);
  }
}

function renderSeriesGrid(list) {
  const grid = document.getElementById("seriesGrid");
  if (!list.length) {
    grid.innerHTML = '<p class="empty-msg">Nenhuma série encontrada.</p>';
    return;
  }
  grid.innerHTML = list.map(s => {
    const id   = s.series_id;
    const name = s.name || "Série";
    const img  = s.cover || "";
    const fav  = isFavorite(id);
    return `
      <div class="card" onclick="openSeries(${id})">
        ${img
          ? `<img class="card-thumb" src="${img}" alt="${escHtml(name)}" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="card-thumb-placeholder poster">📺</div>`}
        <button class="card-fav ${fav ? "active" : ""}"
          onclick="event.stopPropagation(); favToggle({id:'${id}',name:'${escHtml(name)}',cover:'${img}',type:'series'})"
          title="${fav ? "Remover" : "Favoritar"}">
          ${fav ? "★" : "☆"}
        </button>
        <div class="card-info">
          <div class="card-title">${escHtml(name)}</div>
          <div class="card-sub">${s.genre || ""}</div>
        </div>
      </div>`;
  }).join("");
}

async function openSeries(id) {
  const modal   = document.getElementById("seriesModal");
  const content = document.getElementById("seriesModalContent");
  content.innerHTML = `<div class="main-loader"><div class="loader-ring"></div><p>Carregando...</p></div>`;
  modal.classList.remove("hidden");

  try {
    const data = await api(`/api/series/${id}`);
    const info = data.info || {};
    const eps  = data.episodes || {};

    let html = `
      <div class="series-modal-header">
        ${info.cover ? `<img class="series-modal-poster" src="${info.cover}" alt="">` : ""}
        <div class="series-modal-info">
          <h2>${escHtml(info.name || "Série")}</h2>
          <p>${escHtml(info.plot || "")}</p>
        </div>
      </div>`;

    const seasons = Object.keys(eps).sort((a, b) => Number(a) - Number(b));
    if (!seasons.length) {
      html += '<p class="empty-msg">Nenhum episódio disponível.</p>';
    } else {
      seasons.forEach(season => {
        html += `<div class="season-block">
          <div class="season-title">Temporada ${season}</div>
          <div class="ep-list">`;
        eps[season].forEach(ep => {
          const title = ep.title || `Episódio ${ep.episode_num}`;
          html += `
            <button class="ep-btn" onclick="playEpisode('${ep.id}','${escHtml(title)}')">
              <span class="ep-num">${ep.episode_num || "?"}</span>
              <span>${escHtml(title)}</span>
            </button>`;
        });
        html += `</div></div>`;
      });
    }

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<p class="empty-msg">Erro: ${escHtml(err.message)}</p>`;
  }
}

function closeSeriesModal() {
  document.getElementById("seriesModal").classList.add("hidden");
}

// ══════════════════════════════════════
// AO VIVO
// ══════════════════════════════════════
async function loadLive(categoryId = "") {
  setLoader(true);
  try {
    const params = categoryId ? `?category_id=${categoryId}` : "";
    allLive = await api(`/api/live${params}`);
    renderLive(allLive);
  } catch (err) {
    showError("Erro ao carregar canais: " + err.message);
  } finally {
    setLoader(false);
  }
}

function renderLive(list) {
  const grid = document.getElementById("liveGrid");
  if (!list.length) {
    grid.innerHTML = '<p class="empty-msg">Nenhum canal encontrado.</p>';
    return;
  }
  grid.innerHTML = list.map(ch => {
    const id   = ch.stream_id;
    const name = ch.name || "Canal";
    const img  = ch.stream_icon || "";
    const fav  = isFavorite(id);
    return `
      <div class="card" onclick="playLive(${id},'${escHtml(name)}','${img}')">
        <div style="position:relative">
          ${img
            ? `<img class="card-thumb-live" src="${img}" alt="${escHtml(name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\"card-thumb-placeholder wide\\">📡</div>'">`
            : `<div class="card-thumb-placeholder wide">📡</div>`}
          <span class="card-live-dot">AO VIVO</span>
        </div>
        <button class="card-fav ${fav ? "active" : ""}"
          onclick="event.stopPropagation(); favToggle({id:'${id}',name:'${escHtml(name)}',stream_icon:'${img}',type:'live'})"
          title="${fav ? "Remover" : "Favoritar"}">
          ${fav ? "★" : "☆"}
        </button>
        <div class="card-info">
          <div class="card-title">${escHtml(name)}</div>
          <div class="card-sub">${ch.category_name || ""}</div>
        </div>
      </div>`;
  }).join("");
}

// ══════════════════════════════════════
// HERO
// ══════════════════════════════════════
function setHero(movies) {
  const movie = movies.find(m => m.backdrop || m.stream_icon);
  if (!movie) return;
  heroItem = movie;

  const hero = document.getElementById("hero");
  hero.style.backgroundImage = `url(${movie.backdrop || movie.stream_icon})`;
  hero.classList.remove("hidden");

  document.getElementById("heroBadge").textContent    = "DESTAQUE";
  document.getElementById("heroTitle").textContent    = movie.name || "";
  document.getElementById("heroOverview").textContent = movie.overview || "";
  document.getElementById("heroRating").textContent   = movie.rating
    ? `⭐ ${Number(movie.rating).toFixed(1)}`
    : "";
  document.getElementById("heroYear").textContent     = movie.year || "";

  const fav = isFavorite(movie.stream_id);
  document.getElementById("heroFavBtn").textContent = fav ? "★ Favoritado" : "☆ Favoritar";
}

function heroPlay() {
  if (heroItem) playMovie(heroItem.stream_id, heroItem.name, heroItem.stream_icon);
}
function heroFav() {
  if (!heroItem) return;
  const added = favToggle({ id: heroItem.stream_id, name: heroItem.name, stream_icon: heroItem.stream_icon, type: "movie" });
  document.getElementById("heroFavBtn").textContent = added ? "★ Favoritado" : "☆ Favoritar";
}

// ══════════════════════════════════════
// PLAYER
// ══════════════════════════════════════

// Decodifica o token para pegar as credenciais
function getCredsFromToken() {
  const token = getToken();
  if (!token) return {};
  try {
    // token é base64url de JSON com {host, username, password}
    const json = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return getLogin() || {};
  }
}

// Monta URL do stream sempre passando pelo proxy do Vercel
// Isso resolve o problema de Mixed Content (HTTP stream em página HTTPS)
function makeStreamUrl(path) {
  const token = getToken();
  return `/api/proxy?url=${encodeURIComponent(path)}&token=${token}`;
}

async function playMovie(id, name, icon) {
  const creds    = getCredsFromToken();
  const host     = creds.host     || "";
  const username = creds.username || "";
  const password = creds.password || "";

  if (!host || !username || !password) {
    showError("Sessão expirada. Faça login novamente.");
    return;
  }

  const rawUrl    = `${host}/movie/${username}/${password}/${id}.ts`;
  const streamUrl = makeStreamUrl(rawUrl);

  openPlayer({ id, name, icon, url: streamUrl, rawUrl, type: "movie", sub: "Filme" });
}

function playLive(id, name, icon) {
  const creds    = getCredsFromToken();
  const host     = creds.host     || "";
  const username = creds.username || "";
  const password = creds.password || "";

  if (!host || !username || !password) {
    showError("Sessão expirada. Faça login novamente.");
    return;
  }

  const rawUrl    = `${host}/live/${username}/${password}/${id}.ts`;
  const streamUrl = makeStreamUrl(rawUrl);

  openPlayer({ id, name, icon, url: streamUrl, rawUrl, type: "live", sub: "Ao Vivo" });
}

function playEpisode(id, title) {
  closeSeriesModal();
  const creds    = getCredsFromToken();
  const host     = creds.host     || "";
  const username = creds.username || "";
  const password = creds.password || "";

  if (!host || !username || !password) {
    showError("Sessão expirada. Faça login novamente.");
    return;
  }

  const rawUrl    = `${host}/series/${username}/${password}/${id}.ts`;
  const streamUrl = makeStreamUrl(rawUrl);

  openPlayer({ id, name: title, icon: "", url: streamUrl, rawUrl, type: "series", sub: "Episódio" });
}

function openPlayer({ id, name, icon, url, type, sub }) {
  currentItem = { id, name, icon, url, type, sub };
  addToHistory({ id, name, cover: icon, type });

  document.getElementById("playerTitle").textContent = name;
  document.getElementById("playerSub").textContent   = sub;
  document.getElementById("playerLogo").src          = icon || "";
  document.getElementById("playerLogo").style.display = icon ? "block" : "none";

  // Atualiza ícone de favorito
  const fav = isFavorite(id);
  document.getElementById("btnFavPlayer").textContent = fav ? "★" : "☆";
  document.getElementById("btnFavPlayer").title       = fav ? "Remover favorito" : "Favoritar";

  document.getElementById("playerModal").classList.remove("hidden");
  document.getElementById("playerError").classList.add("hidden");
  document.getElementById("playerOverlay").classList.remove("hidden");

  loadStream(url, type, id);
}

function loadStream(url, type, id, useProxy = false) {
  const video = document.getElementById("videoPlayer");

  // Destrói instância HLS anterior
  if (hls) {
    hls.destroy();
    hls = null;
  }
  video.src = "";

  const src = url; // URL já vem roteada pelo proxy via makeStreamUrl()

  const onPlaying = () => {
    document.getElementById("playerOverlay").classList.add("hidden");
    document.getElementById("playerError").classList.add("hidden");
  };
  const onError = () => {
    document.getElementById("playerOverlay").classList.add("hidden");
    document.getElementById("playerError").classList.remove("hidden");
  };

  video.removeEventListener("playing", onPlaying);
  video.removeEventListener("error", onError);
  video.addEventListener("playing", onPlaying);
  video.addEventListener("error", onError);

  // Salvar/restaurar progresso para filmes e séries
  if (type !== "live" && id) {
    const saved = getProgress(id);
    if (saved > 5) {
      video.addEventListener("loadedmetadata", () => {
        video.currentTime = saved;
      }, { once: true });
    }
    video.addEventListener("timeupdate", () => {
      if (video.currentTime > 5) saveProgress(id, video.currentTime);
    });
  }

  const isHls = src.includes(".m3u8") || src.includes("/proxy?");

  if (isHls && Hls.isSupported()) {
    // HLS.js suporta tanto .m3u8 quanto .ts via proxy
    hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      enableWorker: true,
      lowLatencyMode: false,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        onError();
        hls.destroy();
        hls = null;
      }
    });
  } else if (src.includes(".m3u8") && video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari HLS nativo
    video.src = src;
    video.play().catch(() => {});
  } else {
    // .ts direto ou outros formatos
    video.src = src;
    video.play().catch(() => {});
  }
}

function retryPlay() {
  if (!currentItem) return;
  document.getElementById("playerError").classList.add("hidden");
  document.getElementById("playerOverlay").classList.remove("hidden");
  loadStream(currentItem.url, currentItem.type, currentItem.id);
}

function tryProxy() {
  if (!currentItem) return;
  document.getElementById("playerError").classList.add("hidden");
  document.getElementById("playerOverlay").classList.remove("hidden");
  loadStream(currentItem.url, currentItem.type, currentItem.id, true);
}

function closePlayer() {
  document.getElementById("playerModal").classList.add("hidden");
  const video = document.getElementById("videoPlayer");
  video.pause();
  if (hls) { hls.destroy(); hls = null; }
  video.src = "";
}

function pipMode() {
  const video = document.getElementById("videoPlayer");
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
  } else if (video.requestPictureInPicture) {
    video.requestPictureInPicture().catch(() => {});
  }
}

function fullscreenPlayer() {
  const wrap = document.querySelector(".player-container");
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    wrap.requestFullscreen?.() || wrap.webkitRequestFullscreen?.();
  }
}

function toggleFavFromPlayer() {
  if (!currentItem) return;
  const added = favToggle({
    id: currentItem.id,
    name: currentItem.name,
    stream_icon: currentItem.icon,
    type: currentItem.type,
  });
  document.getElementById("btnFavPlayer").textContent = added ? "★" : "☆";
}

// Fecha player com ESC
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!document.getElementById("playerModal").classList.contains("hidden")) closePlayer();
    if (!document.getElementById("seriesModal").classList.contains("hidden")) closeSeriesModal();
  }
});

// Fecha player clicando fora
document.getElementById("playerBackdrop")?.addEventListener("click", closePlayer);

// ══════════════════════════════════════
// FAVORITOS
// ══════════════════════════════════════
function favToggle(item) {
  const added = toggleFavorite(item);
  renderFavorites();
  // Atualiza ícone no grid
  document.querySelectorAll(".card-fav").forEach(btn => {
    const card = btn.closest(".card");
    if (!card) return;
    // Encontra id pelo onclick do card
    const onclick = card.getAttribute("onclick") || "";
    const idMatch = onclick.match(/\d+/);
    if (idMatch && String(idMatch[0]) === String(item.id)) {
      btn.textContent = added ? "★" : "☆";
      btn.classList.toggle("active", added);
    }
  });
  return added;
}

function renderFavorites() {
  const favs = getFavorites();
  const grid = document.getElementById("favGrid");
  const empty = document.getElementById("favEmpty");

  if (!favs.length) {
    empty.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = favs.map(item => {
    const img = item.stream_icon || item.cover || "";
    const type = item.type || "movie";
    const clickFn = type === "live"
      ? `playLive(${item.id},'${escHtml(item.name)}','${img}')`
      : type === "series"
        ? `openSeries(${item.id})`
        : `playMovie(${item.id},'${escHtml(item.name)}','${img}')`;
    return `
      <div class="card" onclick="${clickFn}">
        ${img
          ? `<img class="${type === "live" ? "card-thumb-live" : "card-thumb"}" src="${img}" alt="${escHtml(item.name)}" loading="lazy">`
          : `<div class="card-thumb-placeholder ${type === "live" ? "wide" : "poster"}">${type === "live" ? "📡" : type === "series" ? "📺" : "🎬"}</div>`}
        <button class="card-fav active"
          onclick="event.stopPropagation(); favToggle({id:'${item.id}',name:'${escHtml(item.name)}',stream_icon:'${img}',type:'${type}'})"
          title="Remover">★</button>
        <div class="card-info">
          <div class="card-title">${escHtml(item.name)}</div>
          <div class="card-sub">${type === "live" ? "AO VIVO" : type === "series" ? "Série" : "Filme"}</div>
        </div>
      </div>`;
  }).join("");
}

// ══════════════════════════════════════
// CONTINUAR ASSISTINDO
// ══════════════════════════════════════
function renderContinueWatching() {
  const hist = getHistory();
  const section = document.getElementById("continueWatching");
  const grid    = document.getElementById("continueGrid");
  if (!hist.length) { section.classList.add("hidden"); return; }

  section.classList.remove("hidden");
  grid.innerHTML = hist.map(item => {
    const img = item.cover || "";
    const clickFn = item.type === "live"
      ? `playLive(${item.id},'${escHtml(item.name)}','${img}')`
      : item.type === "series"
        ? `openSeries(${item.id})`
        : `playMovie(${item.id},'${escHtml(item.name)}','${img}')`;
    const prog = getProgress(item.id);
    return `
      <div class="card" onclick="${clickFn}">
        ${img
          ? `<img class="card-thumb" src="${img}" alt="${escHtml(item.name)}" loading="lazy">`
          : `<div class="card-thumb-placeholder poster">🎬</div>`}
        <div class="card-info">
          <div class="card-title">${escHtml(item.name)}</div>
        </div>
        ${prog ? `<div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, (prog / 7200) * 100)}%"></div></div>` : ""}
      </div>`;
  }).join("");
}

// ══════════════════════════════════════
// BUSCA
// ══════════════════════════════════════
function search() {
  const q = document.getElementById("searchInput").value.toLowerCase().trim();

  if (currentTab === "movies") {
    const filtered = q ? allMovies.filter(m => (m.name || "").toLowerCase().includes(q)) : allMovies;
    renderMovies(filtered);
  } else if (currentTab === "series") {
    const filtered = q ? allSeries.filter(s => (s.name || "").toLowerCase().includes(q)) : allSeries;
    renderSeriesGrid(filtered);
  } else if (currentTab === "live") {
    const filtered = q ? allLive.filter(c => (c.name || "").toLowerCase().includes(q)) : allLive;
    renderLive(filtered);
  }
}

// ══════════════════════════════════════
// TABS
// ══════════════════════════════════════
function switchTab(tab) {
  currentTab = tab;

  // Nav items
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  // Tab contents
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");

  // Hero: só em filmes
  const hero = document.getElementById("hero");
  hero.classList.toggle("hidden", tab !== "movies");

  // Recarrega categorias conforme a aba
  const catMap = { movies: "movies", series: "series", live: "live" };
  if (catMap[tab]) loadCategories(catMap[tab]);

  // Limpa busca
  document.getElementById("searchInput").value = "";

  // Fecha sidebar mobile
  document.getElementById("sidebar").classList.remove("open");

  if (tab === "favorites") renderFavorites();
}

// ══════════════════════════════════════
// SIDEBAR MOBILE
// ══════════════════════════════════════
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ══════════════════════════════════════
// PAGINAÇÃO
// ══════════════════════════════════════
function renderPagination(total, page, limit, onPage) {
  const container = document.getElementById("moviesPagination");
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { container.innerHTML = ""; return; }

  let html = `<button ${page <= 1 ? "disabled" : ""} onclick="(${onPage.toString()})(${page - 1})">‹ Anterior</button>`;

  const start = Math.max(1, page - 2);
  const end   = Math.min(pages, page + 2);
  if (start > 1) html += `<button onclick="(${onPage.toString()})(1)">1</button>`;
  if (start > 2) html += `<span style="color:var(--text3)">…</span>`;

  for (let i = start; i <= end; i++) {
    html += `<button class="${i === page ? "active" : ""}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }

  if (end < pages - 1) html += `<span style="color:var(--text3)">…</span>`;
  if (end < pages) html += `<button onclick="(${onPage.toString()})(${pages})">${pages}</button>`;

  html += `<button ${page >= pages ? "disabled" : ""} onclick="(${onPage.toString()})(${page + 1})">Próxima ›</button>`;
  container.innerHTML = html;
}

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function cardHTML(item, type) {
  const id   = item.stream_id;
  const name = item.name || "Sem título";
  const img  = item.poster || item.stream_icon || "";
  const fav  = isFavorite(id);
  const year = item.year ? `<span class="card-sub">${item.year}</span>` : "";
  return `
    <div class="card" onclick="playMovie(${id},'${escHtml(name)}','${img}')">
      ${img
        ? `<img class="card-thumb" src="${img}" alt="${escHtml(name)}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="card-thumb-placeholder poster">🎬</div>`}
      <button class="card-fav ${fav ? "active" : ""}"
        onclick="event.stopPropagation(); favToggle({id:'${id}',name:'${escHtml(name)}',stream_icon:'${img}',type:'movie'})"
        title="${fav ? "Remover" : "Favoritar"}">
        ${fav ? "★" : "☆"}
      </button>
      <div class="card-info">
        <div class="card-title">${escHtml(name)}</div>
        ${year}
      </div>
    </div>`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
