# Airtime

A drag-and-drop timeline builder for assembling a custom "broadcast" out of
recurring audio sources — news briefings, science shorts, poetry readings,
old-time radio drama, and Spotify genre/decade mixes — targeting a total
runtime you set (e.g. 2 hours), then **actually plays it**: podcast blocks
stream their real latest episode, Spotify blocks play through your own
Premium account.

Live at **https://njf520.github.io/airtime/**.

## What works right now

- Browse the source catalog (~31 shows), filter by category (NPR pinned
  first), drag onto a timeline, adjust flexible-length blocks (Spotify
  genre/decade), see running total vs. target length.
- **Hit "Play Broadcast" and it plays for real**: each podcast/archive block
  fetches its actual RSS feed, grabs the latest episode's audio file, and
  streams it; when the block's allotted minutes elapse (or the episode ends),
  it auto-advances to the next block. Transport controls (prev/play-pause/
  next/stop) work mid-broadcast.
- Sources with no working public feed (marked red, "no feed") are skipped
  automatically with a visible message rather than breaking playback.
- Spotify genre/decade blocks play through **your own** Spotify Premium
  account once you connect it (see setup below) — tracks are picked via
  Spotify's Search API and queued to roughly fill the block's length, played
  through the Web Playback SDK (an in-browser Spotify Connect device).
  **Confirmed working end-to-end** with a real account.

## Tech stack

- Single file (`index.html`) — all HTML, CSS, and JS inline, no framework,
  no build step (same approach as `dinner-planner`)
- State (timeline, target length, Spotify tokens) persisted in `localStorage`
- Native HTML5 drag-and-drop (no libraries)
- Podcast audio: fetch the RSS feed (direct, falling back through a chain of
  public CORS proxies since most podcast feeds don't set CORS headers for
  browser JS), parse the latest `<item>`'s `<enclosure>` URL with
  `DOMParser`, play it with a plain `<audio>` element (media playback itself
  isn't subject to CORS, only reading the feed XML is)
- Spotify: Authorization Code + PKCE (no client secret, safe for a pure
  client-side app), Web Playback SDK for in-browser playback, Search API to
  build a track queue matching a genre/decade query

## Setting up Spotify playback

Spotify doesn't allow embedding a single shared app across arbitrary sites,
so each user needs their own free Developer app (~1 minute):

1. Go to `developer.spotify.com/dashboard`, create an app.
2. Add the exact redirect URI shown in the "Connect Spotify" dialog (the
   page's own URL, e.g. `https://njf520.github.io/airtime/`) to the app's
   settings, and check **Web API** + **Web Playback SDK** under "Which
   API/SDKs are you planning to use?"
3. Copy the Client ID into the dialog and click Connect — this redirects to
   Spotify's login/consent screen and back (PKCE flow, no secrets exposed).
4. Requires Spotify **Premium** — the Web Playback SDK refuses to output
   audio on free accounts.

**Known gotcha:** ad blockers and privacy extensions commonly block
`apresolve.spotify.com`, `spclient.wg.spotify.com`, and the
`dealer.g2.spotify.com` WebSocket — all part of the Web Playback SDK's actual
connection, not just its initial script. Symptom: the button gets stuck on
"Spotify: connecting device…" and the console shows `ERR_BLOCKED_BY_CLIENT`
and a WebSocket failure. Fix: test in an InPrivate/Incognito window first to
confirm it's an extension, then disable the offending one for this site (or
just use InPrivate every time).

## Source catalog

`SOURCES` in `index.html` lists ~31 audio sources, each tagged with
category, cadence, typical length, `sourceType`, and `feedStatus`:

- `verified` — fetched and confirmed working (from either the dev sandbox or
  a real browser)
- `unverified` — a documented/likely-real feed that couldn't be fetched from
  this dev environment (CBC's As It Happens and Quirks & Quarks, and
  Radiolab — all failed even through every CORS proxy tried, suggesting
  those hosts may block proxy/datacenter traffic specifically) but might
  still work fine from your own residential connection — worth a live test
- `none` — no working public feed exists for that block; it's skipped during
  playback with a visible message rather than removed from the catalog

Four sources that were initially marked `none` after the first research pass
turned out to have real feeds a second, more thorough pass found: **DW News
Brief** (renamed from generic "DW News" — it's a ~90 second hourly brief, not
a 30-minute broadcast), **BBC Thought for the Day**, **StarTalk Radio**
(had migrated hosting platforms, leaving the commonly-cited old feed stale/
empty), and **A Moment of Science** (hosted on PRX/Dovetail rather than
WFIU's own domain). Lesson: "couldn't find it" isn't the same as "doesn't
exist" — worth a second pass with different search strategies before
deleting a source.

**The Shipping Forecast was removed entirely**, confirmed structurally
impossible rather than just hard to find: it has no Apple Podcasts/iTunes
listing, and per BBC's own distribution details it is only ever broadcast
live or streamed on-demand via BBC Sounds — never packaged as discrete,
independently-fetchable episodes with a permanent feed.

Three other sources were removed outright (not just marked unavailable)
because the underlying show/organization no longer produces new audio at
all: **CBS News Radio** (the network shut down entirely on 2026-05-22 after
99 years), **The Writer's Almanac** (Garrison Keillor now publishes it as a
newsletter/website only, no audio), and **News from Lake Wobegon** (A
Prairie Home Companion ended production in 2016; only scattered archived
monologues remain, no clean feed).

The Internet Archive's old-time-radio *collection* feed points at item
detail pages rather than direct audio — `otr-drama` is wired instead to a
specific, well-organized Archive.org item (the "Suspense" series, 460
individual episode files) and picks one at random each play.

## Known limitations / next steps

- **As It Happens, Quirks & Quarks, and Radiolab** remain unverified from
  this dev environment specifically — worth testing live rather than
  assuming broken.
- **No real reordering test with actual mouse drags yet** — the drop zone
  accepts reorders programmatically (verified), worth a manual pass in a
  real browser.
- Optional: PWA polish (manifest, service worker) to match
  `dinner-planner`'s install/offline setup.

## Development

There's no build step — open `index.html` directly, or serve the folder
(e.g. `python -m http.server`) and visit it in a browser.
