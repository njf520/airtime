# Airtime (commercial branch)

A drag-and-drop timeline builder for assembling a custom "broadcast" out of
recurring audio sources — news briefings, science shorts, poetry readings,
old-time radio drama, and internet-radio genre/decade/mood mixes — then
**actually plays it**: podcast blocks stream their real latest episode,
music blocks stream from live internet radio stations via the free
Radio-Browser directory. No accounts, no sign-in, no per-user caps.

**This branch has no Spotify integration.** The `master` branch has Spotify
mixed in for personal use; this branch replaces it entirely with
Radio-Browser because Spotify's Developer Policy prohibits segueing Spotify
content with other audio sources in one continuous stream — see "Scaling
this to the public" below for the exact policy text and reasoning. Every
source on this branch (podcasts, archives, internet radio, and the
Radio-Browser-backed Music genre/decade/mood channels) is legally clear for
public/commercial use with no platform-imposed user cap.

Live (personal-use `master` branch) at **https://njf520.github.io/airtime/**.

## Scaling this to the public

The user asked directly: what would it take to open this up to lots of
people, not just one person's browser? Here's the honest breakdown.

**Podcast/RSS/internet-radio sources scale to unlimited users for free.**
There's no backend, no per-user state beyond `localStorage`, and GitHub
Pages serves static files at effectively unlimited scale for free. The one
real risk was the free public CORS proxies (`corsproxy.io`,
`api.allorigins.win`, `api.codetabs.com`) — fine for one person, but a
popular public site hammering them could get rate-limited or blocked
outright, and they're the actual cause of the "StarDate works on one
machine but not another" flakiness reported live. **Done**: deployed
`cors-proxy-worker.js` as a dedicated Cloudflare Worker
(`airtime-cors-proxy.njf520.workers.dev`, same account as `dinner-planner`'s
`worker.js`) — tried first, before falling back to the free public ones.
Verified directly via `curl` that it returns the real feed content with the
correct CORS header for the production origin (and, as designed, refuses
requests from any other origin — including this repo's local dev server,
which is why testing locally still falls through to the free proxies).
Cloudflare's free tier (100k requests/day) comfortably covers this app's
traffic.

**Spotify was the real constraint on `master`, and it was a hard platform
limit, not a code problem.** Spotify apps start in "Development Mode,"
capped at **25 total users** who must be individually allowlisted by email
in the developer dashboard, and — separately — Spotify's Developer Policy
(Section III, "Some prohibited applications") explicitly states:

> "Do not permit any device or system to segue, mix, re-mix, or overlap
> any Spotify Content with any other audio content (including other
> Spotify Content)."
>
> "Do not create any product or service which is integrated with streams
> or content from another service."

This described `master`'s exact architecture — sequencing Spotify playback
between podcast and internet-radio blocks in one continuous timeline. Low
enforcement risk for pure personal use, but not something to build a public
or commercial product on top of. **This branch's answer**: drop Spotify
entirely and lead with Radio-Browser for the music portion instead — see
"Radio-Browser integration + dropping Spotify" below. Radio-Browser is a
free, open, community-run station directory with no developer account, no
OAuth, no per-user cap, and no equivalent restriction on how its content is
used, so every source on this branch scales to unlimited users at zero
platform-imposed cost.

## What works right now

- Browse the source catalog (~113 shows/channels), filter by category (NPR
  pinned first), by typical length (under 5 min / 5-20 min / 20+ min —
  flexible radio blocks show up in every length bucket since their length is
  user-set), and by format (Podcast / Internet Radio); drag onto a timeline,
  adjust flexible-length blocks, see the running total.
- **Hit "Play Broadcast" and it plays for real**: each podcast/archive block
  fetches its actual RSS feed, grabs the latest episode's audio file, and
  streams it; when the block's allotted minutes elapse (or the episode ends),
  it auto-advances to the next block. Transport controls (prev/play-pause/
  next/stop) work mid-broadcast.
- Sources with no working public feed (marked red, "no feed") are skipped
  automatically with a visible message rather than breaking playback.
- Music genre/decade/mood blocks (Jazz, 80s, Chill, etc.) resolve live via
  the Radio-Browser API to real internet radio stations tagged with that
  genre/mood/decade — no account, sign-in, or setup needed at all. A custom
  channel field lets you search any genre/mood/format directly.
  **Confirmed working end-to-end** against the live API.

## Tech stack

- Single file (`index.html`) — all HTML, CSS, and JS inline, no framework,
  no build step (same approach as `dinner-planner`)
- State (timeline, rundowns, custom channels) persisted in `localStorage`
- Native HTML5 drag-and-drop (no libraries)
- Podcast audio: fetch the RSS feed (direct, falling back through a chain of
  public CORS proxies since most podcast feeds don't set CORS headers for
  browser JS), parse the latest `<item>`'s `<enclosure>` URL with
  `DOMParser`, play it with a plain `<audio>` element (media playback itself
  isn't subject to CORS, only reading the feed XML is)
- Radio-Browser: `radioBrowserSearch()` queries the public API's
  `/json/stations/search` endpoint (tag search first, name search as a
  fallback), tried across a couple of mirror hosts for resilience, and
  returns every matching station as a `tryLoadAudio` candidate list — dead
  or broken stations get skipped exactly like a broken podcast feed

## Radio-Browser integration + dropping Spotify

This branch replaces every Spotify genre/decade/mood source with an
equivalent internet-radio source resolved live via
[Radio-Browser](https://www.radio-browser.info/), a free, open, community-
run directory of internet radio stations with a public, CORS-enabled API
and no developer account or API key required.

- **`feedUrl: 'radio-browser:tag:<tag>'`** is a new special-cased scheme in
  `fetchLatestEpisode()`, alongside the existing `date-archive:`,
  `direct-stream:`, and `somafm:` schemes. It calls `radioBrowserSearch()`
  and turns every matching station into a `{ audioUrl, title }` candidate —
  reusing `tryLoadAudio()`'s existing candidate-probing loop unchanged, so a
  dead or unreachable station is skipped exactly like a broken podcast feed,
  with zero new plumbing needed.
- **Resolved URLs only.** Radio-Browser's own health-checker follows
  playlist-wrapper (`.pls`/`.m3u`) redirects and stores the actual stream
  URL in `url_resolved` — always preferred over the raw `url` field.
  Candidates are also filtered to exclude HLS streams (`hls: 1` or a
  `.m3u8` URL), since a plain `<audio src>` can't play HLS in Chrome or
  Firefox (only Safari supports it natively), and this app has no
  MSE/hls.js player to handle it.
- **Mirror fallback.** `RADIO_BROWSER_HOSTS` tries `all.api.radio-browser.info`
  (the project's own load-balanced entry point) first, then two explicit
  `de1`/`de2` mirrors as a fallback — verified live via `curl` that all
  three respond with real station data and `Access-Control-Allow-Origin: *`.
  Two other commonly-cited mirror hostnames (`nl1`, `at1`) no longer
  resolved when checked, which is exactly why this list shouldn't be
  trusted indefinitely — if it ever goes fully stale, the current mirror
  list can be found by resolving `all.api.radio-browser.info` or checking
  `api.radio-browser.info`.
- **English-language stations preferred, with a fallback.** Reported live:
  "Rock (Radio)" and "1980s Music (Radio)" resolved to the exact same
  (German) station. Root cause, confirmed via `curl`: an unfiltered tag
  search sorted by clickcount skews heavily toward whichever country
  dominates that tag in Radio-Browser's dataset (German/French stations for
  a broad tag like "rock"), and the same few big multi-tag European
  stations kept winning completely different genre searches — one German
  station tagged both "rock" and "80s" was the #1 hit for both tags.
  `radioBrowserSearch()` now tries `language=english` first for both the
  tag and name search, falling back to unfiltered only if that comes back
  empty (so a genuinely niche custom search doesn't just return nothing).
  Verified live across every built-in tag, including niche ones like
  `kpop`, that this doesn't zero out results — and that previously-colliding
  tags like `rock`/`80s` now resolve to different, actual English-named
  stations.
- **Decade-focused stations + a stricter language check.** Separately
  reported live: "1990s Music (Radio)" was playing 1970s tracks with
  Spanish DJ chatter between songs. Root cause, confirmed via `curl`: a
  generic "oldies" station tagged with 7 different decades at once
  (60s/70s/80s/90s/...) was the clickcount-sorted #1 hit for the `90s` tag
  despite not being decade-specific — and its tag list mixed in Spanish
  words among the English ones, a sign the self-reported `language` field
  wasn't trustworthy for it either. Two new client-side filters (with the
  same filter-with-fallback-if-empty safety net as the English-language
  one): `hasFocusedDecadeTags()` deprioritizes any station tagged with 3+
  distinct decades, and `isMonolingualEnglish()` requires the `language`
  field to be *exactly* `"english"`, not just contain it — Radio-Browser's
  own `?language=` query param does a substring match, so a station
  self-tagged `"english,german"` was passing it. (The `language` field is
  self-reported and not verified against the actual audio, so this remains
  a best-effort signal, not a guarantee — but it's a meaningfully stronger
  one than the API's own filter.) Verified live that `90s` now leads with
  genuine single-decade English stations (Heart 90s, iHeart90s Radio,
  181.FM 90's Country), and that this doesn't break other tags.
- **26 built-in Music sources** (`rb-jazz`, `rb-80s`, `rb-chill`, etc.)
  replace the old `spotify-*` catalog entries one-for-one, each mapped to an
  equivalent Radio-Browser tag (verified live that every tag returns real
  results, e.g. `rnb`, `kpop`, `chillout`, `study`, `roadtrip`, `romantic`
  aren't guesses). The custom-channel field now searches Radio-Browser (tag
  first, station name as a fallback) instead of Spotify, so it's better
  suited to genres/moods/formats than specific artists.
- **No more Spotify OAuth/PKCE flow, Web Playback SDK, "Connect Spotify"
  button, or Spotify Client ID setup.** Deleted entirely, along with the
  `playerState.mode` distinction it required — every block now plays
  through the same plain `<audio>` element, since there's only ever one
  playback path left.

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

## Network tags and a Format filter

Two follow-up questions worth answering directly:

**"Shouldn't there be a Podcast category?"** — not as a *genre* category
(it'd match ~80 of 113 sources, too broad to be a useful filter), but yes
as an independent filter dimension distinguishing *delivery format* from
*subject*. Added a **Format filter** (Podcast / Internet Radio / Spotify)
alongside the existing category and length filters — `FORMAT_GROUPS`
matches on `sourceType` under the hood.

**"Can each source show which network/publisher it's from (e.g. a BBC
tag)?"** — yes: every source now has a `network` field (NPR, BBC, AP, CBC,
Internet Archive, SomaFM, Radio Paradise, KEXP, Spotify, or the specific
publisher for independent shows like Pushkin Industries/Crooked Media/
audiochuck/etc.), shown as its own accent-colored tag on the card, assigned
via an explicit `NETWORK_MAP` lookup (with `spotify-`/`soma-` id-prefix
fallbacks, and `"Independent"` as the final fallback) so it didn't require
touching all 113 individual catalog entries by hand. The search box also
now matches against network, so typing "BBC" surfaces all 5 BBC shows at
once — tested and confirmed.

## Rundowns (saved broadcast presets) + fade transitions

Prompted by feedback on an AI-generated competitive analysis of Airtime,
which suggested a "Broadcast Profile" feature and criticized abrupt
block-to-block cuts:

- **Rundowns** — named, saved timeline presets (the term is real
  broadcast-industry vocabulary for a planned segment lineup, chosen over
  the analysis's proposed "Broadcast Profile"). Built on the existing
  Export/Import foundation, but stored directly in `localStorage` under a
  name rather than requiring a file download/upload each time. Critically,
  a rundown stores `sourceId`/`lengthMin` per block, **not specific
  episodes** — loading "My 8am Commute" next week grabs whatever's
  currently latest for every date-sensitive/rolling source, not a stale
  snapshot. Save/Load/Delete all tested directly, including that Load
  re-hydrates block names/categories from the *current* catalog rather than
  trusting the saved snapshot (in case a source's info changed since).
- **Fade transitions** — block-to-block cuts were an abrupt
  `audioEl.pause()`/`spotifyPause()` with zero warning, jarring mid-song or
  mid-sentence. Added a ~1.2s volume fade-out before actually stopping,
  for both the `<audio>` element and the Spotify SDK player (skipped
  entirely if nothing is playing yet, e.g. the very first block). Tested
  live: volume measurably drops mid-transition, then the next block starts
  at the restored target volume.

**Follow-up fix**: the fade/cutoff above was originally tied to the
block's *assigned* length estimate for every source type — meaning a fixed
5-minute news show that's actually 5:22 got faded out 22 seconds early,
mid-sentence (reported live). Fixed content (podcasts, OTR) should play to
its natural end regardless of the estimate; only genuinely open-ended
sources (Spotify queues, live internet radio) should get cut off at the
budget, since that's the whole point there. Now branches on the catalog's
own `flexible` field: fixed sources rely on the `<audio>` element's real
`ended` event (with a generous 2x+5min safety-net cutoff only in case
something stalls and never fires it), while flexible sources keep the
original hard budget cutoff. The scrub bar also now tracks the real audio
duration for fixed content once metadata loads, instead of the assigned
estimate. Tested both directions live: a 1-minute-budget podcast block
kept playing 65+ seconds in with no natural end yet, then correctly
advanced the moment `ended` fired; a 1-minute-budget radio stream still
cut off right at 61 seconds as before.

## No more target-length picker

Removed the "target length" hours/minutes input entirely — you don't need
to decide 2 hours vs 4 upfront, just add blocks and see the running total
("Total broadcast time: 1h 15m"). Simpler mental model, and it was mostly
vestigial once Rundowns existed anyway. `targetMinutes` is fully gone from
new Rundowns/exports; old exported files with a stray `targetMinutes`
field just have it silently ignored on import rather than erroring.

## Now-playing time display + archive labeling

- The now-playing bar shows elapsed/total time for the **current block
  only** (e.g. "0:18 / 4:58"), never the whole broadcast. For fixed
  content, "total" is the real audio duration once its metadata loads
  (confirmed live: showed the actual 4:58 runtime of a specific episode,
  not the assigned 5-minute estimate) — for flexible content it's the
  budget you set.
- Any source that plays from a fixed archive rather than a fresh/latest
  episode is now labeled as such in its name — "The Writer's Almanac
  (archive)", "A Prairie Home Companion (full show, archive)", and each
  old-time-radio series ("Suspense (Old-Time Radio, archive)", etc.) — so
  it's clear upfront these are old episodes, not today's.

## Visual time-blocking

The timeline is no longer a linear text list — it's a wrapping row of blocks
whose **width is proportional to how long they run** (clamped between
120px and 320px so a 2-minute StarDate and a 2-hour PHC broadcast are both
readable). Flexible sources (Spotify, internet radio) get a translucent
diagonal-stripe pattern to signal they'll be cut off at whatever time is
left, rather than running to a fixed natural length like a podcast episode.
Drag-and-drop reordering was rewritten to do real 2D (x/y) hit-testing
instead of just comparing vertical position, since blocks now wrap across
multiple rows. On mobile (`max-width: 768px`), blocks fall back to full
width in a simple stacked list — the proportional layout is desktop-only.

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

## Playback error recovery + live-stream pause fix

- **Mid-playback format/network errors now auto-skip.** Previously, once a
  block's audio actually started playing, there was no error handling at
  all — only the initial candidate-loading phase (`tryLoadAudio`) caught
  failures. If a stream errored *after* starting (an unsupported codec on a
  given browser — e.g. Safari doesn't support `.ogg` at all — or a mid-play
  network drop), the broadcast would just silently stall forever. There's
  now a persistent `audioEl` `error` listener that shows a "Playback error
  — skipping in 2s…" message and auto-advances, guarded so it doesn't
  double-fire with `tryLoadAudio`'s own candidate-probing error handling
  (tracked via a `probingAudio` flag).
- **Live radio streams no longer jump on pause/resume.** A live internet
  radio stream is infinite and unseekable, unlike a podcast file. Just
  calling `audioEl.pause()`/`.play()` on it (the previous behavior) let the
  browser keep whatever got buffered while paused, so resuming played
  through that backlog and surfaced as a jarring jump forward once it
  caught up to the live edge. Pausing a live-stream block now tears down
  the connection (`removeAttribute('src')` + `load()`); resuming
  reassigns the stream URL fresh and reconnects, landing back at the live
  edge instead of a stale buffer. Fixed-length content (podcasts, OTR) is
  unaffected — it pauses/resumes normally since there's a real buffer to
  resume from.

## UI polish: light/dark mode, log tucked away, honest duration fields

- **Light/dark toggle** (🌙/☀️ button in the header). Every color in the app
  was already a CSS custom property on `:root`, so a `:root[data-theme="light"]`
  override block covers the whole UI; a couple of hardcoded translucent-white
  overlays (chip backgrounds, the flexible-block stripe pattern) were pulled
  into `--tint-weak`/`--tint-strong` variables too, since a white-based tint
  is nearly invisible on a light background. Preference is read and applied
  by an inline script in `<head>`, before the stylesheet is even parsed, so
  there's no flash of the wrong theme on load; persisted in `localStorage`,
  defaulting to the OS-level `prefers-color-scheme` if never toggled.
- **Playback log tucked behind a collapsed `<details>` disclosure**, closed
  by default. It's genuinely useful (per-block status history, copyable),
  but sitting open by default read as debug output left in the UI.
- **Fixed-length blocks (StarDate, podcasts, OTR, etc.) no longer show an
  editable duration field.** That number never controlled their actual
  playback length (they play to their own natural end regardless — see
  "Let fixed-content shows finish naturally" above), so an editable-looking
  input next to them was actively misleading. They now show a plain
  `~N min` estimate with a tooltip explaining it's just for the running
  total; only genuinely flexible sources (internet radio, Spotify) keep the
  editable field, since that number really does set their cutoff.

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

## Bug fixes from live testing (round 3)

- **Free radio channels were invisible under the "Music" filter** — added
  in the previous session under a separate "Radio" category instead of
  "Music", so a user looking for free music channels under Music didn't
  see them. Moved all 33 (SomaFM/Radio Paradise/KEXP) to `category: 'Music'`
  — the Format filter (Podcast/Internet Radio/Spotify) already distinguishes
  delivery format, so the separate category was redundant anyway. Confirmed
  live: Music category now shows 63 entries including SomaFM/Radio
  Paradise, and combining it with the Internet Radio format filter narrows
  correctly to exactly 33.
- **Spotify search intermittently rejected `limit=50` with a confusing
  "Invalid limit" 400** — reported live, with the actual Spotify error
  message visible thanks to the error-detail logging added earlier:
  `Spotify API error 400: Invalid limit`. The exact same query worked with
  a smaller limit elsewhere, and Spotify's documented max is 50 — root
  cause unclear, but the fix doesn't need to be certain to be safe: try 20
  first, retry once at 10 if that fails too, before giving up.
- **A feed could fail with "possibly a proxy error page" on one machine
  while working fine on another** (StarDate, reported live) — all 4 CORS
  proxies returning bad content in the same pass is usually a transient,
  shared issue (a rate-limit window, a momentary outage), not a dead feed.
  Added one full retry pass after a 1.5s pause; confirmed the happy path
  still resolves in ~1s with no added latency when the first pass succeeds.

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

**Later refinement:** the ↑/↓ reorder buttons were originally shown at every
screen width, but on desktop that's pure redundant clutter next to drag —
dragging works fine there. They're now `display: none` above the 768px
breakpoint and only reappear (at their existing enlarged, tappable size)
below it, where they're load-bearing since drag genuinely doesn't work.

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
