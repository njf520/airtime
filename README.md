# Airtime

A drag-and-drop timeline builder for assembling a custom "broadcast" out of
recurring audio sources — news briefings, science shorts, poetry readings,
old-time radio drama, and Spotify genre/decade mixes — targeting a total
runtime you set (e.g. 2 hours), then **actually plays it**: podcast blocks
stream their real latest episode, Spotify blocks play through your own
Premium account.

## What works right now

- Browse the source catalog (~32 shows), filter by category (NPR pinned
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
   page's own URL) to the app's settings.
3. Copy the Client ID into the dialog and click Connect — this redirects to
   Spotify's login/consent screen and back (PKCE flow, no secrets exposed).
4. Requires Spotify **Premium** — the Web Playback SDK refuses to output
   audio on free accounts.

## Source catalog

`SOURCES` in `index.html` lists ~32 audio sources, each tagged with
category, cadence, typical length, `sourceType`, and `feedStatus`:

- `verified` — fetched and confirmed working during development
- `unverified` — a documented/likely-real feed that couldn't be confirmed
  from the dev sandbox (blocked 403 or network error) but is still tried live
- `none` — no working public feed exists yet for an otherwise still-active
  show (e.g. Shipping Forecast, DW News, BBC Thought for the Day, A Moment
  of Science, StarTalk); the block is skipped during playback with a
  visible message rather than removed from the catalog

Three sources were removed outright rather than just marked unavailable,
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

- **Feed reliability varies.** A few sources (CBC's As It Happens/Quirks &
  Quarks, Radiolab) are consistently blocked from this dev environment —
  they may or may not work from your own browser/network; if they fail
  live, the sequencer skips them gracefully rather than breaking.
- **No real reordering test with actual mouse drags yet** — the drop zone
  accepts reorders programmatically (verified), worth a manual pass in a
  real browser.
- **Spotify OAuth flow itself hasn't been exercised against a real Spotify
  account** (needs your own Client ID) — the PKCE crypto and API plumbing
  are verified in isolation, but a first live connect is worth doing.
- Optional: PWA polish (manifest, service worker, GitHub Pages hosting) to
  match `dinner-planner`'s install/offline setup.

## Development

There's no build step — open `index.html` directly, or serve the folder
(e.g. `python -m http.server`) and visit it in a browser.
