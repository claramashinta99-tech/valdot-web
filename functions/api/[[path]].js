const DEFAULT_UPSTREAM = "https://api.sansekai.my.id/api/dramabox";

const routes = {
  latest: { upstreamPath: "latest", ttl: 300 },
  trending: { upstreamPath: "trending", ttl: 300 },
  search: { upstreamPath: "search", ttl: 180 },
  detail: { upstreamPath: "detail", ttl: 1800 },
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function getRouteName(params) {
  const raw = params?.path;
  if (Array.isArray(raw)) return raw.join("/");
  return String(raw || "").replace(/^\/+|\/+$/g, "");
}

function cleanValue(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export async function onRequestGet(context) {
  const routeName = getRouteName(context.params);
  const route = routes[routeName];

  if (!route) {
    return json(
      { error: "Endpoint tidak tersedia." },
      404,
      { "Cache-Control": "no-store" },
    );
  }

  const incomingUrl = new URL(context.request.url);
  const upstreamBase = String(context.env?.UPSTREAM_API || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  const upstreamUrl = new URL(`${upstreamBase}/${route.upstreamPath}`);

  if (routeName === "search") {
    const query = cleanValue(incomingUrl.searchParams.get("query"), 80);
    if (!query) return json({ error: "Query pencarian wajib diisi." }, 400, { "Cache-Control": "no-store" });
    upstreamUrl.searchParams.set("query", query);
  }

  if (routeName === "detail") {
    const bookId = cleanValue(incomingUrl.searchParams.get("bookId"), 120);
    if (!bookId) return json({ error: "bookId wajib diisi." }, 400, { "Cache-Control": "no-store" });
    upstreamUrl.searchParams.set("bookId", bookId);
  }

  const canonicalCacheUrl = new URL(incomingUrl.origin);
  canonicalCacheUrl.pathname = `/api/${routeName}`;
  canonicalCacheUrl.search = upstreamUrl.search;

  const cacheKey = new Request(canonicalCacheUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Valdot-Cache", "HIT");
    return response;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Valdot-Catalog/1.0",
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });
  } catch {
    return json(
      { error: "API sumber sedang tidak dapat dihubungi." },
      502,
      { "Cache-Control": "no-store" },
    );
  }

  const body = await upstreamResponse.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json(
      { error: "API sumber mengirim respons yang tidak valid." },
      502,
      { "Cache-Control": "no-store" },
    );
  }

  if (!upstreamResponse.ok) {
    const message = parsed?.error || parsed?.message || "Permintaan ke API sumber gagal.";
    return json(
      { error: message },
      upstreamResponse.status,
      { "Cache-Control": "no-store", "X-Valdot-Cache": "BYPASS" },
    );
  }

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=60, s-maxage=${route.ttl}, stale-while-revalidate=${route.ttl * 2}`,
    "X-Content-Type-Options": "nosniff",
    "X-Valdot-Cache": "MISS",
  });

  const response = new Response(JSON.stringify(parsed), {
    status: 200,
    headers,
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
