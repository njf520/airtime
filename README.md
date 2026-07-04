# Airtime

A drag-and-drop timeline builder for assembling a custom "broadcast" out of
recurring audio sources — news briefings, science shorts, poetry readings,
old-time radio drama, and Spotify genre/decade mixes — targeting a total
runtime you set (e.g. 2 hours), then **actually plays it**: podcast blocks
stream their real latest episode, Spotify blocks play through your own
Premium account.

Live at **https://njf520.github.io/airtime/**.

## What works right now

- Browse the source catalog (~37 shows), filter by category (NPR pinned
  first) and by typical length (under 5 min / 5-20 min / 20+ min — flexible
  Spotify blocks show up in every length bucket since their length is
  user-set), drag onto a timeline, adjust flexible-length blocks, see
  running total vs. target length.
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

`SOURCES` in `index.html` lists ~33 audio sources, each tagged with
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

**CBS News Radio was removed outright** — the network shut down entirely on
2026-05-22 after 99 years, so no archive exists to fall back to, unlike the
two below.

**The Writer's Almanac is back**, despite no longer producing new episodes,
because it's a show organized by *calendar date* rather than a rolling feed
— a listener wants "the July 3rd edition," not literally today in the
current year. Real archived audio still exists at
`download.publicradio.org/podcast/writers_almanac/YYYY/MM/twa_YYYYMMDD_64.mp3`
for every day the show aired (1993–2016). `writers-almanac` now builds one
candidate URL per year for today's month+day and tries them newest-first
using the `<audio>` element's own load success/failure events (no separate
CORS-sensitive existence check needed) until one actually plays.

**News from Lake Wobegon stays removed, but differently:** the monologue
itself was never released as a standalone audio file — it only exists
embedded inside the full ~2-hour *Prairie Home Companion* broadcast, with no
timestamp data to jump to it, so it can't be isolated without transcribing/
detecting the segment ourselves (out of scope). Rather than fake a "12-minute
Lake Wobegon" block that's actually a random slice of a variety show, added
**`phc-full-show`** instead — the complete broadcast, honestly labeled as the
full ~2-hour show rather than just the segment.

**Important distinction baked into how dates are chosen:** StarDate (tells
you what's visible in tonight's sky) and the Writer's Almanac (a specific
day-in-history) are genuinely date-sensitive — they must match today's
calendar date. StarDate gets this for free since it's still actively
produced (its RSS feed's "latest" episode already is today's, whenever it's
fetched); the Writer's Almanac gets it via a deliberate year-fallback search
for today's month+day. **Prairie Home Companion is not date-sensitive** —
any episode is fine — so `phc-full-show` instead picks a *random* month/day
and searches across years (1980–2016) for a broadcast that exists, rather
than wastefully cycling through years hunting for one specific day that may
never have aired.

The Internet Archive's old-time-radio *collection* feed points at item
detail pages rather than direct audio, so each OTR series is wired to a
specific, well-curated Archive.org item instead (verified via the metadata
API to contain real per-episode MP3 files, not a zip archive) and picks one
episode at random each play. Five distinct series now, each a different
Archive.org item with no overlapping content: **Suspense** (460 episodes),
**Dragnet** (185), **Gunsmoke**, 1952-1961 (274), **The Shadow**, original
1937-1954 broadcasts (164), and **Sherlock Holmes** with Basil Rathbone and
Nigel Bruce (107). A few other series were checked and rejected as either
zip-only bundles (Whistler) or too-small samplers (X Minus One, Escape,
Yours Truly Johnny Dollar) rather than full single-item collections.

All date/random-fallback sources (`writers-almanac`, `phc-full-show`, the
five OTR series) share `fetchLatestEpisode`'s candidate-list contract: it
returns `{ candidates: [...] }`, and `tryLoadAudio()` walks the list using
the `<audio>` element's real load/error events until one succeeds — this
also sidesteps a separate CORS-sensitive existence-check fetch.

## PWA / mobile install

Installable on Android (and desktop) as a home-screen app: `manifest.json`
+ `sw.js` (offline app-shell caching, network-first for `index.html` so
updates are picked up when online) + `icon-192.png`/`icon-512.png`
(generated by `generate_icons.py`, same play-button-with-broadcast-waves
glyph as the favicon). This was a direct copy of `dinner-planner`'s exact
PWA pattern — genuinely easy since that template already existed. On
Android Chrome, visit the live URL and use "Add to Home screen"; it'll
launch standalone (no browser chrome) with its own icon.

Resizable panes: drag the vertical bar between the source library and the
timeline to resize them (`#pane-divider`, backed by a `--library-width` CSS
variable, clamped 220-640px, persisted in `localStorage`).

## Known limitations / next steps

- **As It Happens, Quirks & Quarks, and Radiolab** remain unverified from
  this dev environment specifically — worth testing live rather than
  assuming broken.
- **No real reordering test with actual mouse drags yet** — the drop zone
  accepts reorders programmatically (verified), worth a manual pass in a
  real browser.

## Bug fixes from live testing

- **Timeouts were too strict** — a real playlist skipped its first two
  blocks (StarDate and a Spotify block) because per-request timeouts (6-10s)
  weren't generous enough for some hosts/connections. Raised RSS/Archive.org
  fetch timeouts to 15s and the `<audio>` per-candidate load timeout to 12s.
- **Spotify blocks could skip immediately even when "connected"** — right
  after connecting (or on a fresh page load), the Web Playback SDK's device
  can take a few seconds to come online; the code was checking
  `spotifyState.deviceId` synchronously and failing instantly if it wasn't
  set yet, rather than giving it a chance. Added `waitForSpotifyDevice()`,
  which polls for up to 12s before giving up.
- Added a favicon (inline SVG data URI, no extra files needed).
- **Spotify's `genre:` search filter is only valid for artist search, not
  track search** — the Jazz block was sending `q=genre:jazz&type=track`,
  which Spotify rejects with a 400. Switched to a plain `jazz` keyword
  search. Also made `spotifyApi()` surface Spotify's actual error message
  body instead of just the HTTP status code.
- **A "good" feed could still fail with "did not parse as XML"** — the free
  CORS proxies have no reliability guarantee, and one occasionally returns
  its own error page (HTML/JSON/rate-limit message) with a 200 status
  instead of the real feed; `fetchTextWithProxies` was accepting any
  non-empty 200 response as success. Added `looksLikeXml()` to validate the
  response before accepting it, falling through to the next proxy
  otherwise — reproduced this exactly with StarDate, where the feed itself
  was fine but a bad proxy response poisoned the result.
- **Race condition: rapidly skipping/stopping could let stale background
  work clobber the current block** — `tryLoadAudio`'s candidate loop (and
  the fetch/Spotify calls around it) only checked whether the user had moved
  on *after* fully resolving, not during. If you skipped away from a block
  whose feed was still being resolved (e.g. Writer's Almanac cycling through
  candidate years), that old work kept running in the background and could
  still write to `audioEl.src` after you'd moved elsewhere. Added a
  `playGeneration` counter, bumped at the start of every `playBlockAt()`
  call and checked at every await point (including inside `tryLoadAudio`'s
  loop); anything from a superseded call now bails out immediately.
  Reproduced and confirmed fixed: rapidly skipping past a block mid-fetch no
  longer causes interference.

## Mobile / touch support

Native HTML5 drag-and-drop (`draggable="true"`, `dragstart`/`drop`) **does
not fire at all on touchscreens** — Android Chrome, iOS Safari, none of
them. Since the whole point of this app was Android use, that would have
made the core interaction unusable on a phone despite the PWA install
working fine. Added tap-based alternatives that work everywhere, with drag
still available as a bonus on desktop:

- Each source card has a **"+" button** that appends it to the end of the
  timeline (`addSourceToTimeline()`, shared with the drop handler).
- Each timeline block has **↑/↓ buttons** to reorder it (`moveBlock()`),
  disabled at the ends of the list.
- A **"Clear all"** button on the timeline (with a confirm prompt) to reset
  without removing blocks one at a time.
- An **empty-state message** when the library's filters/search combine to
  match zero sources, instead of a silently blank panel.
- Timeline blocks referencing a source that's since been removed from the
  catalog now show a visible "source removed" badge instead of just
  silently skipping during playback with no on-screen explanation.

**Separately, and more severely:** the two-pane layout itself had zero
responsive handling — no media queries at all. Tested at 375px (phone
width) and the library panel held its fixed 340px while the timeline column
was squeezed to 48px, completely unusable. Added a `max-width: 768px` media
query that stacks the panes vertically, hides the (meaningless-on-mobile)
resize divider, lets the page scroll naturally instead of two independent
fixed-height scroll panes, and wraps the header controls properly (the
Play Broadcast button was overflowing the viewport by ~40px before a
`flex-wrap` fix). Verified both the phone-width layout and that desktop
(1280px) is unaffected.

## Versioning

The header shows a version badge (e.g. `v1.1.0`) next to the title, driven
by the `VERSION` constant near the top of the `<script>` block. On every
deploy, bump `VERSION` **and** `CACHE_NAME` in `sw.js` together — the
service worker uses `CACHE_NAME` to know when to discard old cached assets,
so if they drift out of sync, installed/offline clients can get stuck
serving a stale version.

## Development

There's no build step — open `index.html` directly, or serve the folder
(e.g. `python -m http.server`) and visit it in a browser.
