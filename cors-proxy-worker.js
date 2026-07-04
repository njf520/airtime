// Airtime — dedicated CORS proxy for podcast/RSS feed fetching.
//
// Most podcast RSS feeds don't set Access-Control-Allow-Origin, since they're built for podcast
// apps, not browser JS. This is a small, dedicated proxy so Airtime doesn't have to depend on
// free public CORS-proxy services (corsproxy.io, allorigins.win, codetabs.com), which have no
// reliability guarantee and occasionally return their own error page instead of the real feed.
// Deploy this as a Cloudflare Worker (same account as dinner-planner's worker.js), then add its
// URL as the first entry in Airtime's CORS_PROXIES list in index.html.
//
// GET /?url=<encoded target URL> -> fetches that URL server-side and returns it with CORS headers
// added, so it's readable from https://njf520.github.io/airtime/'s browser JS.

const ALLOWED_ORIGIN = 'https://njf520.github.io';
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024; // 20MB -- generous for an RSS feed or a .pls file

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}

// Basic SSRF guard -- refuse obviously-internal targets. Not exhaustive, but Cloudflare Workers
// run in an isolated sandbox with no real access to internal networks anyway, so this is defense
// in depth rather than the only safeguard.
function isPrivateHost(hostname) {
  return /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1\]?)$/i.test(hostname);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response('Invalid url parameter', { status: 400, headers: corsHeaders() });
    }
    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return new Response('Only http/https URLs are allowed', { status: 400, headers: corsHeaders() });
    }
    if (isPrivateHost(targetUrl.hostname)) {
      return new Response('Refusing to fetch a private/internal address', { status: 400, headers: corsHeaders() });
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        headers: { 'User-Agent': 'AirtimeCorsProxy/1.0 (+https://njf520.github.io/airtime/)' },
        redirect: 'follow',
      });
      const contentLength = upstream.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        return new Response('Upstream response too large', { status: 502, headers: corsHeaders() });
      }
      const body = await upstream.arrayBuffer();
      if (body.byteLength > MAX_RESPONSE_BYTES) {
        return new Response('Upstream response too large', { status: 502, headers: corsHeaders() });
      }
      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
          ...corsHeaders(),
        },
      });
    } catch (e) {
      return new Response('Upstream fetch failed: ' + (e.message || 'unknown error'), { status: 502, headers: corsHeaders() });
    }
  },
};
