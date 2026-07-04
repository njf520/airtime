# Airtime

A drag-and-drop timeline builder for assembling a custom "broadcast" out of
recurring audio sources — news briefings, science shorts, poetry readings,
old-time radio drama, and Spotify genre/decade mixes — targeting a total
runtime you set (e.g. 2 hours), then **actually plays it**: podcast blocks
stream their real latest episode, Spotify blocks play through your own
Premium account.

Live at **https://njf520.github.io/airtime/**.

## Scaling this to the public

The user asked directly: what would it take to open this up to lots of
people, not just one person's browser? Here's the honest breakdown.

**Podcast/RSS/internet-radio sources scale to unlimited users for free.**
There's no backend, no per-user state beyond `localStorage`, and GitHub
Pages serves static files at effectively unlimited scale for free. The one
real risk is the free public CORS proxies (`corsproxy.io`,
`api.allorigins.win`, `api.codetabs.com`) — fine for one person, but a
popular public site hammering them could get rate-limited or blocked
outright. **Recommended hardening**: deploy a small dedicated Cloudflare
Worker as a first-choice CORS proxy (falling back to the public ones), the
same pattern already used for `dinner-planner`'s `worker.js` (which proxies
GitHub + Anthropic calls) — a ~20-line Worker that just fetches a URL and
adds CORS headers would remove the dependency on third-party proxy
reliability entirely, and Cloudflare's free tier comfortably covers a
public hobby project's traffic. I can draft this Worker on request; I
can't deploy it myself since it needs your Cloudflare account.

**Spotify is the real constraint, and it's a hard platform limit, not a
code problem.** Spotify apps start in "Development Mode," capped at **25
total users** who must be individually allowlisted by email in the
developer dashboard — this applies per registered app (per Client ID), not
per code deployment. Three realistic paths:
1. **Friends-and-family scale (≤25 people)**: works today. You (as the app
   owner) add each person's Spotify account email to the allowlist in your
   existing app's dashboard. No code changes needed.
2. **Request Extended Quota Mode from Spotify**: a real approval process
   (business justification, app review) — not guaranteed, and Spotify has
   gotten stricter post-2024. Worth trying if you want genuinely public
   Spotify integration, but plan for it to possibly be denied or slow.
3. **Lead with the new Radio category instead** (see below) — these need
   zero per-user auth at all, so they're the actual path to "the masses"
   for the music portion, with Spotify staying available as a bonus for
   whoever connects their own account.

**Legal footing is solid.** Every podcast source just links to the
creator's own publicly-published RSS feed and audio file — this is exactly
what every podcast app (Apple Podcasts, Overcast, Spotify itself) does, not
redistribution. The internet radio stations are explicitly free/listener-
supported services designed to be streamed. Spotify playback goes through
their own official SDK under the user's own authorized account, same as
any legitimate third-party Spotify app.

## What works right now

- Browse the source catalog (~113 shows/channels), filter by category (NPR
  pinned
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

`SOURCES` in `index.html` lists ~113 audio sources/channels, each tagged
with category, cadence, typical length, `sourceType`, and `feedStatus`:

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

## Major catalog expansion — "most popular sources" + free radio + more Spotify

Prompted by "what are the most popular ~50 sources, and should we add the
ones we're missing" — checked 20 of the biggest English-language podcasts
not yet covered, all with real WebFetch-verified feeds (not guessed):
**Freakonomics Radio, 99% Invisible, Stuff You Should Know, Crime Junkie,
SmartLess, How I Built This, Pod Save America, Armchair Expert, Hidden
Brain, Revisionist History, You're Wrong About, Song Exploder, No Such
Thing As A Fish, The Ezra Klein Show, Planet Money, and 60 Minutes** — 16
added (Hardcore History's free feed is stuck at a 2020 episode with newer
ones sold individually through Dan Carlin's store, so excluded as
unsuitable for "plays the latest episode"; My Favorite Murder and Criminal
couldn't be verified this pass — recent distribution changes, re-check
before adding; WTF with Marc Maron ended permanently in Oct 2025, excluded
as a dead show).

**Added a "Free Internet Radio" category (33 channels) that needs zero
per-user authentication at all** — the direct fix for "Spotify won't
satisfy everyone" and for Spotify's user-cap scaling problem. **SomaFM**
(27 channels: Groove Salad, Drone Zone, Metal Detector, Left Coast 70s,
Reggae, and 22 more, covering ambient/metal/reggae/folk/lounge/vaporwave/
and more), **Radio Paradise** (5: Main/Mellow/Rock/Global/Beyond mixes),
and **KEXP**'s live stream — all nonprofit/listener-supported, commercial-
free, and confirmed CORS-open (`Access-Control-Allow-Origin: *`).
Real engineering catch here: SomaFM's per-channel `.pls` playlist filenames
don't follow one consistent `{id}{bitrate}.pls` pattern (Metal Detector's
highest-quality MP3 playlist is `metal.pls`, not `metal128.pls` — a guess
based on the other 26 channels' naming would have silently broken this one
specific channel). Fixed by resolving through SomaFM's authoritative
`channels.json` API instead of hardcoding filenames — verified all 33
channels resolve and stream correctly after the fix, where 1 had silently
failed before it. Also confirmed the resolved `ice*.somafm.com` edge server
actually did rotate between two test runs in this session (ice6 → ice4),
validating the decision to resolve at play time rather than hardcode a
specific edge server.

**Expanded Spotify from 2 to ~26 preset channels** (15 genres: rock,
hip-hop, classical, country, electronic, reggae, blues, folk, metal, R&B,
indie, punk, latin, k-pop, funk; 6 decades: 60s-2010s; 6 moods: workout,
chill, focus, party, sleep, road trip, love songs) plus a **custom channel
feature** — type any artist/mood/era into a text box and it becomes a real
timeline block, persisted across sessions. Also fixed a real quality
issue while doing this: Spotify's Search API only supports genre filtering
for *artist* search, not track search, so a plain keyword track search was
just fuzzy-matching titles — mediocre results. `buildSpotifyQueue()` now
searches for a curated official Spotify editorial playlist first (owner id
`spotify`) and pulls its tracks, falling back to plain track search only if
no decent playlist turns up — meaningfully better genre/mood accuracy.
(Couldn't test this live myself — my sandbox browser was never Spotify-
authenticated, only the live site was, from your account — worth
confirming quality live.)

Total catalog: **113 sources** (up from 37), spanning News, NPR, Business,
Storytelling, Comedy, True Crime, Science, Poetry, Reflection, History,
Drama, International, Weather, Radio, and Music.

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

- **As It Happens, Quirks & Quarks, and Radiolab** consistently fail through
  every CORS proxy tried (7 total across two rounds of testing, from both a
  dev sandbox and a real browser) — the feeds themselves are real, but CBC
  and WNYC most likely block proxy/datacenter traffic specifically. Not
  fixable client-side without a real backend server, which is out of scope
  for this no-build static app. Kept in the catalog (the shows are real and
  active) with an honest note in the description rather than removed, and
  the tap-to-add "+" / drag-and-drop still skip them gracefully at playback
  time if they fail.
- **Reordering has been tested via the tap-based ↑/↓ buttons and
  programmatic drag simulation, but not yet with a real mouse drag** in an
  actual browser — worth a manual pass.

## Playback log

Error/skip messages only appeared in the now-playing status line for the
~2 seconds before the sequencer auto-advanced, making them impossible to
read or copy in time (reported live: "StarDate errors out but the error is
on screen for just a second so I can't copy it"). Every status message now
also gets appended to a persistent, scrollable, copyable log
(`#playback-log`) via a single hook in `setNowPlaying()` — no need to catch
the toast in time anymore. Entries are color-coded (red if the message
contains "skipping", which every failure/skip path ends with; green if it
contains "playing") and mirrored to `console.error` for failures. A "Copy
log" button copies the full session log as plain text, falling back to a
selectable `prompt()` dialog if the Clipboard API is unavailable. Also
fixed a related, worse gap while doing this: a timeline block whose source
had been removed from the catalog skipped **completely silently** with no
message at all, not even a flash — now shows and logs "This source no
longer exists in the catalog."

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
- **Target-length inputs accepted negative/out-of-range values** — typing
  `-5` for hours passed straight through into `targetMinutes`, breaking the
  progress-bar math. Now clamps hours to >= 0 and minutes to 0-59, and
  writes the clamped value back into the inputs so the UI doesn't silently
  disagree with the stored state.
- **Changing a block's duration while it's the one currently playing had no
  effect** — the change handler updated the stored `lengthMin` but not
  `playerState.blockBudgetSec`, so the old duration kept governing auto-
  advance until the next play-through (which may never come, since each
  block only plays once per pass). Now applies live if it's the active
  block.

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

Also grew the icon-only buttons (add/move/remove) from 24-26px to 40-44px
specifically under the mobile media query — comfortable with a mouse, but
genuinely hard to tap precisely on a real phone screen otherwise.

## Accessibility & new features

- Added `aria-label`s to every icon-only button (transport controls,
  add/move/remove) so screen readers announce something meaningful instead
  of relying on `title` alone (inconsistent screen-reader support).
- Added a **volume slider** in the now-playing bar, applied to both the
  `<audio>` element and the Spotify Web Playback SDK's player, persisted
  across sessions.
- Fixed a gap in the Spotify OAuth handling: if the user denies consent (or
  any other auth error), Spotify redirects back with `?error=...` instead of
  `?code=...` — this was silently falling through with the error param stuck
  in the URL bar. Now shown as a clear alert and the URL is cleaned up
  either way.
- Added **Export/Import** for the timeline — Export downloads the current
  timeline + target length as a dated JSON file; Import reads one back in
  (with a confirm prompt if you already have a non-empty timeline, so it
  can't silently clobber work). Validates the file actually looks like an
  Airtime export (a `blocks` array with well-formed entries) before
  accepting it, and rejects malformed JSON/wrong-shape files with a clear
  message rather than corrupting the timeline — tested all three failure
  modes (invalid JSON syntax, valid JSON missing the `blocks` array, and a
  `blocks` array with malformed entries) plus the valid round-trip.

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
