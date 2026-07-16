const API = "/api";

const views = {
  home: document.querySelector("#homeView"),
  search: document.querySelector("#searchView"),
  detail: document.querySelector("#detailView"),
};

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const trendingGrid = document.querySelector("#trendingGrid");
const latestGrid = document.querySelector("#latestGrid");
const searchGrid = document.querySelector("#searchGrid");
const searchTitle = document.querySelector("#searchTitle");
const searchCount = document.querySelector("#searchCount");
const detailContent = document.querySelector("#detailContent");
const skeletonTemplate = document.querySelector("#cardSkeleton");

const fallbackPoster = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24152f"/><stop offset=".52" stop-color="#5f1d49"/><stop offset="1" stop-color="#11131a"/></linearGradient></defs>
    <rect width="600" height="900" fill="url(#g)"/>
    <circle cx="450" cy="230" r="190" fill="#ff315f" opacity=".18"/>
    <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="104" font-family="Arial" font-weight="700">V</text>
    <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#d9d9df" font-size="30" font-family="Arial" letter-spacing="8">VALDOT</text>
  </svg>
`)}`;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImageUrl(value) {
  if (!value) return fallbackPoster;
  try {
    const parsed = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : fallbackPoster;
  } catch {
    return fallbackPoster;
  }
}

function normalizeList(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.result,
    payload?.list,
    payload?.books,
    payload?.records,
    payload?.data?.list,
    payload?.data?.books,
    payload?.data?.records,
  ];

  const list = candidates.find(Array.isArray) || [];
  return list.filter((item) => item && typeof item === "object" && (item.bookId || item.id));
}

function normalizeDetail(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload?.data?.book) return payload.data.book;
  if (payload?.book) return payload.book;
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  return payload;
}

function getId(item) {
  return String(item?.bookId || item?.id || "").trim();
}

function getTitle(item) {
  return String(item?.bookName || item?.title || item?.name || "Judul tidak tersedia").trim();
}

function getCover(item) {
  return safeImageUrl(item?.coverWap || item?.cover || item?.poster || item?.image);
}

function getEpisodeCount(item) {
  const count = Number(item?.chapterCount ?? item?.episodeCount ?? item?.episodes ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function renderSkeletons(container, count = 6) {
  container.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    container.appendChild(skeletonTemplate.content.cloneNode(true));
  }
}

function cardMarkup(item, index = 0) {
  const id = getId(item);
  const title = getTitle(item);
  const cover = getCover(item);
  const episodes = getEpisodeCount(item);
  const corner = item?.corner?.name || item?.label || (index < 3 ? `TOP ${index + 1}` : "");

  return `
    <article class="media-card">
      <a href="/?id=${encodeURIComponent(id)}" data-detail-id="${escapeHtml(id)}" aria-label="Buka detail ${escapeHtml(title)}">
        <div class="poster-wrap">
          <img class="poster" src="${escapeHtml(cover)}" alt="Poster ${escapeHtml(title)}" loading="lazy" decoding="async" />
          <div class="poster-shade"></div>
          ${corner ? `<span class="badge">${escapeHtml(corner)}</span>` : ""}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(title)}</h3>
          <p class="card-meta">${episodes ? `${episodes} episode` : "Drama pendek"}</p>
        </div>
      </a>
    </article>
  `;
}

function renderCards(container, items, emptyMessage = "Belum ada data untuk ditampilkan.") {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  container.innerHTML = items.map(cardMarkup).join("");
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <strong>Data belum bisa dimuat</strong>
      <span>${escapeHtml(message || "Coba muat ulang beberapa saat lagi.")}</span>
    </div>
  `;
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const response = await fetch(`${API}/${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.error || body?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Permintaan terlalu lama. Coba lagi.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });
  document.querySelector("#app")?.focus({ preventScroll: true });
}

async function loadHome() {
  showView("home");
  document.title = "Valdot — Katalog Drama";
  renderSkeletons(trendingGrid, 6);
  renderSkeletons(latestGrid, 6);

  const [trendingResult, latestResult] = await Promise.allSettled([
    fetchJson("trending"),
    fetchJson("latest"),
  ]);

  if (trendingResult.status === "fulfilled") {
    renderCards(trendingGrid, normalizeList(trendingResult.value), "Belum ada daftar trending.");
  } else {
    renderError(trendingGrid, trendingResult.reason?.message);
  }

  if (latestResult.status === "fulfilled") {
    renderCards(latestGrid, normalizeList(latestResult.value), "Belum ada drama terbaru.");
  } else {
    renderError(latestGrid, latestResult.reason?.message);
  }
}

async function loadSearch(query) {
  const cleanQuery = String(query || "").trim().slice(0, 80);
  if (!cleanQuery) {
    navigate("/");
    return;
  }

  showView("search");
  searchInput.value = cleanQuery;
  searchTitle.textContent = `“${cleanQuery}”`;
  searchCount.textContent = "Sedang mencari…";
  document.title = `${cleanQuery} — Valdot`;
  renderSkeletons(searchGrid, 6);

  try {
    const payload = await fetchJson(`search?query=${encodeURIComponent(cleanQuery)}`);
    const items = normalizeList(payload);
    renderCards(searchGrid, items, `Tidak ada judul yang cocok dengan “${cleanQuery}”.`);
    searchCount.textContent = `${items.length} judul ditemukan`;
  } catch (error) {
    renderError(searchGrid, error?.message);
    searchCount.textContent = "Pencarian gagal";
  }
}

function getTags(detail) {
  const source = detail?.tags || detail?.tagNames || detail?.labels || detail?.typeTwoNames || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((tag) => (typeof tag === "string" ? tag : tag?.tagName || tag?.name))
    .filter(Boolean)
    .slice(0, 6);
}

async function loadDetail(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) {
    navigate("/");
    return;
  }

  showView("detail");
  document.title = "Memuat detail — Valdot";
  detailContent.innerHTML = `
    <div class="detail-loader">
      <button class="text-button" data-home>← Kembali ke beranda</button>
      <div class="skeleton" style="height:420px;border-radius:28px"></div>
    </div>
  `;

  try {
    const payload = await fetchJson(`detail?bookId=${encodeURIComponent(cleanId)}`);
    const detail = normalizeDetail(payload);
    if (!detail || (!detail.bookId && !detail.bookName && !detail.title)) {
      throw new Error("Detail judul tidak ditemukan.");
    }

    const title = getTitle(detail);
    const cover = getCover(detail);
    const intro = detail?.introduction || detail?.description || "Sinopsis belum tersedia.";
    const episodes = getEpisodeCount(detail);
    const tags = getTags(detail);
    const language = detail?.language || "";
    const viewCount = detail?.viewCount || detail?.playCount || "";
    const officialSearch = `https://www.google.com/search?q=${encodeURIComponent(`${title} DramaBox resmi`)}`;

    document.title = `${title} — Valdot`;
    detailContent.innerHTML = `
      <article class="detail-hero">
        <img class="detail-backdrop" src="${escapeHtml(cover)}" alt="" aria-hidden="true" />
        <div class="detail-overlay"></div>
        <div class="detail-inner">
          <img class="detail-poster" src="${escapeHtml(cover)}" alt="Poster ${escapeHtml(title)}" />
          <div class="detail-copy">
            <button class="text-button" data-home>← Kembali ke beranda</button>
            <p class="section-kicker">DETAIL DRAMA</p>
            <h1>${escapeHtml(title)}</h1>
            <div class="detail-meta">
              ${episodes ? `<span class="meta-pill">${episodes} episode</span>` : ""}
              ${language ? `<span class="meta-pill">${escapeHtml(language)}</span>` : ""}
              ${viewCount ? `<span class="meta-pill">${escapeHtml(viewCount)} ditonton</span>` : ""}
              ${tags.map((tag) => `<span class="meta-pill">${escapeHtml(tag)}</span>`).join("")}
            </div>
            <p class="detail-intro">${escapeHtml(intro)}</p>
            <div class="detail-actions">
              <a class="official-button" href="${escapeHtml(officialSearch)}" target="_blank" rel="noopener noreferrer">Cari di platform resmi</a>
              <button class="secondary-button" type="button" data-copy-title="${escapeHtml(title)}">Salin judul</button>
            </div>
          </div>
        </div>
      </article>
    `;
  } catch (error) {
    detailContent.innerHTML = `
      <div class="page-shell">
        <button class="text-button" data-home>← Kembali ke beranda</button>
        <div class="error-state">
          <strong>Detail belum bisa dibuka</strong>
          <span>${escapeHtml(error?.message || "Coba lagi nanti.")}</span>
        </div>
      </div>
    `;
  }
}

function navigate(url, replace = false) {
  if (replace) history.replaceState({}, "", url);
  else history.pushState({}, "", url);
  route();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function route() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const query = params.get("q");

  if (id) loadDetail(id);
  else if (query) loadSearch(query);
  else loadHome();
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query) navigate(`/?q=${encodeURIComponent(query)}`);
});

document.addEventListener("click", async (event) => {
  const detailLink = event.target.closest("[data-detail-id]");
  if (detailLink) {
    event.preventDefault();
    navigate(`/?id=${encodeURIComponent(detailLink.dataset.detailId)}`);
    return;
  }

  if (event.target.closest("[data-home]")) {
    event.preventDefault();
    searchInput.value = "";
    navigate("/");
    return;
  }

  const copyButton = event.target.closest("[data-copy-title]");
  if (copyButton) {
    const title = copyButton.dataset.copyTitle || "";
    try {
      await navigator.clipboard.writeText(title);
      const oldText = copyButton.textContent;
      copyButton.textContent = "Judul disalin";
      setTimeout(() => { copyButton.textContent = oldText; }, 1500);
    } catch {
      copyButton.textContent = title;
    }
  }
});

document.addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement && event.target.src !== fallbackPoster) {
    event.target.src = fallbackPoster;
  }
}, true);

window.addEventListener("popstate", route);
route();
