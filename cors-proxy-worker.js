// Airtime — dedicated CORS proxy for podcast/RSS feed fetching, plus a narrow Lemon Squeezy
// license-verify passthrough for the Premium gate.
//
// Most podcast RSS feeds don't set Access-Control-Allow-Origin, since they're built for podcast
// apps, not browser JS. This is a small, dedicated proxy so Airtime doesn't have to depend on
// free public CORS-proxy services (corsproxy.io, allorigins.win, codetabs.com), which have no
// reliability guarantee and occasionally return their own error page instead of the real feed.
// Deployed as a Cloudflare Worker (same account as dinner-planner's worker.js) at
// airtime-cors-proxy.njf520.workers.dev, wired in as the first entry in Airtime's CORS_PROXIES
// list in index.html. If you ever need to redeploy from scratch: create a new Worker in the
// Cloudflare dashboard ("Start with Hello World!"), paste this file's contents into its code
// editor, and Deploy.
//
// GET /?url=<encoded target URL> -> fetches that URL server-side and returns it with CORS headers
// added, so it's readable from https://njf520.github.io/airtime/'s browser JS.
//
// POST /license-verify {licenseKey} -> forwards to Lemon Squeezy's license validate API
// (server-to-server only -- it doesn't set CORS headers for browser callers), checks the key
// actually belongs to the Airtime Premium product, and returns a simple {success, message} shape
// so index.html doesn't need to know anything about Lemon Squeezy's response format. This is a
// narrowly-scoped route (fixed upstream URL, no user-supplied target) rather than opening the
// general proxy to POST, which would turn it into an open relay.

const ALLOWED_ORIGIN = 'https://njf520.github.io';
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024; // 20MB -- generous for an RSS feed or a .pls file

// TODO: replace with the real numeric product ID once the Airtime Premium product exists in Lemon
// Squeezy (Dashboard -> Products -> the product -> its ID is in the URL and on the product page).
// This isn't a secret -- it's just used to confirm a validated key belongs to *this* product,
// in case the store ever sells anything else.
const LEMONSQUEEZY_PRODUCT_ID = 'REPLACE_WITH_LEMONSQUEEZY_PRODUCT_ID';

function corsHeaders(methods = 'GET,OPTIONS') {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleLicenseVerify(request) {
  const headers = { ...corsHeaders('POST,OPTIONS'), 'Content-Type': 'application/json' };
  let licenseKey;
  try {
    const body = await request.json();
    licenseKey = String(body.licenseKey || '').trim();
  } catch (e) {
    console.error('handleLicenseVerify: request body was not valid JSON.', e);
    return new Response(JSON.stringify({ success: false, message: 'Invalid request body' }), { status: 400, headers });
  }
  if (!licenseKey) {
    return new Response(JSON.stringify({ success: false, message: 'Missing license key' }), { status: 400, headers });
  }

  try {
    const upstream = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ license_key: licenseKey }).toString(),
    });
    const data = await upstream.json();

    if (!data.valid) {
      return new Response(JSON.stringify({ success: false, message: data.error || 'Invalid license key' }), { status: 200, headers });
    }
    if (String(data.meta?.product_id) !== String(LEMONSQUEEZY_PRODUCT_ID)) {
      return new Response(JSON.stringify({ success: false, message: 'This key is not for Airtime Premium' }), { status: 200, headers });
    }
    const status = data.license_key?.status;
    if (status === 'disabled' || status === 'expired') {
      return new Response(JSON.stringify({ success: false, message: 'This license is ' + status }), { status: 200, headers });
    }

    return new Response(JSON.stringify({
      success: true,
      key: data.license_key?.key,
      email: data.meta?.customer_email || null,
    }), { status: 200, headers });
  } catch (e) {
    console.error('handleLicenseVerify: request to Lemon Squeezy failed.', e);
    return new Response(JSON.stringify({ success: false, message: 'Verification request failed: ' + (e.message || 'unknown error') }), { status: 502, headers });
  }
}

// Basic SSRF guard -- refuse obviously-internal targets. Not exhaustive, but Cloudflare Workers
// run in an isolated sandbox with no real access to internal networks anyway, so this is defense
// in depth rather than the only safeguard.
function isPrivateHost(hostname) {
  return /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1\]?)$/i.test(hostname);
}

async function handleRssProxy(request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  if (!target) {
    return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch (e) {
    console.warn('handleRssProxy: malformed ?url= parameter "' + target + '".', e);
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
    console.warn('handleRssProxy: upstream fetch failed for "' + targetUrl.toString() + '".', e);
    return new Response('Upstream fetch failed: ' + (e.message || 'unknown error'), { status: 502, headers: corsHeaders() });
  }
}

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;

    if (path === '/license-verify') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders('POST,OPTIONS') });
      }
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders('POST,OPTIONS') });
      }
      return handleLicenseVerify(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }
    return handleRssProxy(request);
  },
};
