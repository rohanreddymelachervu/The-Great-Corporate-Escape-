# THE GREAT OFFICE ESCAPE: 4:59 PM

> You've finished your work. Unfortunately, nobody else has.

An original, entirely client-side pixel-art stealth game about escaping a Bangalore startup on Friday. Built with **Phaser 3, TypeScript and Vite**. No backend, accounts, runtime AI, API keys, database, analytics or paid gameplay services.

## Play

**Public game:** https://hyperagent.com/s/0RA76fgitXB1NI7B7D0-mA

This is the verified Hyperagent preview of version 1.1. The GitHub Pages production file is also committed at docs/index.html. Pages publication is waiting for the repository owner to enable main /docs in repository settings; it is not yet claimed live.

The release includes five campaign floors, a seeded daily challenge, six enemy personalities, six functional abilities, original procedural pixel art and audio, local records, medals and 12 achievements. Start with **CLOCK OUT**. Collect your badge, activate the highlighted switch with **E**, and enter the elevator. The gold arrow indicates your next objective.

A production build and self-contained HTML release can be generated using the commands below. The self-contained file also works offline, including its fonts, game engine, artwork and soundtrack.

## Version 1.1 — clear layout and actual HR fun

- The map, objective/status rail, notifications, dialogue and controls now occupy separate layout regions. No HUD cards float over gameplay. Only the next objective, unlocked abilities and one nearby speaker are shown.
- Portrait and landscape touch layouts have separate controls and a following camera. A ResizeObserver keeps the canvas matched to its own viewport.
- **HR Fun Friday: Clap for the Culture** is a real five-beat timing game. Play the bonus from the main menu, or use E at pink HR booths on floors 2, 4 and 5.
- Three good claps grant −25 BS, one coffee, a 12-second HR distraction, and an accuracy-based score bonus. Failure adds 8 BS. Booths are single-use per floor. The office pauses, but activity time counts toward the run. Practice has its own local high score and does not modify campaign progress.

## Development

Node **22+** and npm are recommended. No environment variables or secrets are needed.

```sh
npm ci
npm run dev
```

Vite listens on port 4173. Open the URL printed by Vite on your own machine. This is a development URL, not a public deployment.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Outputs:
- `dist/`: conventional static website for Cloudflare Pages and other static hosts.
- `release/office-escape.html`: self-contained, single-file game with no network dependencies.
- `docs/index.html` and `docs/.nojekyll`: GitHub Pages-ready production output. Unlike other generated output, docs is intentionally committed for branch-based Pages hosting.

`dist` and `release` are generated and intentionally gitignored. Rebuild them from source. The game is approximately 1.9 MB uncompressed; most of that is Phaser and bundled open-source fonts. HTTP compression reduces the transfer considerably. Vite's large-chunk warning is expected: this project intentionally bundles the engine to eliminate a runtime CDN dependency.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys | Drag the virtual joystick |
| Sprint | Hold Shift | Hold RUN |
| Interact / hide | E / Space | ACT |
| Coffee distraction | 1 | COFFEE |
| Fake client call | 2 | CLIENT CALL |
| Slack camouflage | 3 | BUSY |
| Calendar blocker | 4 | CALENDAR |
| VPN disconnect | 5 | VPN |
| Emergency WFH | 6 | WFH |
| Pause | Escape / pause button | Pause button |
| Mute | M / sound button | Sound button |
| Retry result | R / retry button | Retry button |

Touch controls support simultaneous joystick movement and actions. Landscape gives a wider field of view; both orientations are playable. Mobile cameras follow the employee. On large desktop screens, the entire floor is visible. Settings provide independent music/SFX volume, mute and reduced camera effects. Audio begins only after a user gesture. Losing tab focus pauses the run.

## Five floors

1. **The Quick Sync** — A welcoming, partitioned desk/reception/pantry loop. Learn vision, coffee and hiding against a single manager.
2. **Mandatory Fun Friday** — Cross party dividers, recover a confiscated badge and stop the playlist. HR, manager and gossip overlap their routes.
3. **The Yappening** — Open-plan islands and two erratic, fast interns. Camouflage and calendar blockers join the toolkit.
4. **The All-Hands Ambush** — Executive/conference routes, founder, product manager and shifting office events. VPN and a rare WFH alternative become available.
5. **Founder Mode** — All six major threats, guarded reception and a separate purple WFH escape. Finish to reach the Bangalore street outside.

Each map has its own geometry, objectives, furnishings, patrols and shortcuts. Locked gates are shortcuts, not unavoidable gates to required objectives. Optional laptops reward riskier detours. Coffee pickups and pantry breaks help recover from mistakes.

## Stealth and enemy rules

- Directional vision cones use wall/furniture-blocked line of sight. A filling awareness ring provides more than a second of grace before pursuit.
- The finite-state machine supports patrol, investigation, chase, search and distraction. Enemies use radius-inflated A* navigation and the same swept collision rules as the player.
- Sprinting can be heard nearby if there is a clear acoustic path. Production incidents mask sprint noise.
- Breaking sight loses pursuit after a search; designated purple hide rings break sight immediately. Moving exits hiding and cancels Slack camouflage.
- Getting caught adds Corporate BS, not conventional health. There is a three-second global escape grace period. At 100 BS, you are promoted to staying late.
- Manager: scheduled desk patrols, occasional Slack stops, susceptible to urgent blockers.
- HR: broader vision and forced-fun event rings. The pink ring builds BS; walk around it, hide or block meetings.
- Intern: fastest patrol speed, unpredictable route changes, nearby yap slows movement. Fake calls do not help. Listen to all four monologue parts to earn Yappologist.
- Founder: longest vision, largest catch penalty, ignores fake calls. All Hands temporarily expands office awareness and redirects patrols.
- PM: scope events briefly delay the elevator. The VPN ability cancels the delay; the detailed roadmap distracts PM.
- Gossip: broadcasts a discovered employee's location to nearby enemies and offers occasional useful pantry information.

No enemy teleports or walks through desks. Distraction stations deliberately provide strong, readable counters to enemy personalities.

## Ability balance

| Ability | First floor | Effect | Limits |
|---|---:|---|---|
| Coffee | 1 | Toss ahead; enemies within hearing range investigate for 7s | 2 starting cups, max 5, 3s cooldown; pickups/stations refill |
| Fake client call | 2 | Managers, HR, PM and gossip defer for 7s | 24s cooldown; intern/founder ignore it |
| Slack camouflage | 3 | Avoid vision and interactions while stationary for 8s | Movement cancels; 18s cooldown |
| Calendar blocker | 3 | Reject catches for 7s, even moving | Suspicion remains; 28s cooldown |
| VPN disconnect | 4 | Freeze enemies and cancel office events for 5s | 35s cooldown |
| Emergency WFH | 4 | Open that floor's alternate purple exit | Requires rare house pickup; badge and switch still required |

Pantry coffee restores 18 BS, fills stamina and adds a cup, with a 22s station cooldown. Hiding slowly reduces BS. Single-use thematic distractions reduce BS and occupy their target personality for 10s. Scoring caps distraction credit to discourage farming.

## Scores, medals and daily challenges

Score = 2 × HR activity accuracy points + 5000 + max(0, 2 × floor par − seconds) × 35 + 2500 if never spotted + 1500 if never caught + 300 per laptop + 150 per distraction (max 6) − 18 per final BS − 180 per spotting, rounded with a 100-point minimum.

- **Ghost Employee:** no sightings or catches, and within 1.5× the floor par time.
- **Gold:** 9500+ if not eligible for Ghost.
- **Silver:** 6500+.
- **Bronze:** completed the floor.

Daily challenge dates use **UTC**, not the device's local calendar day. Everyone gets the same date-selected floor and initial seed. The simulation uses a fixed 60 Hz step, an explicit PRNG and equal starting resources. Identical input sequences produce identical simulation choices; player choices naturally change future behavior. Best scores and achievements live in LocalStorage. **There is no server leaderboard or anti-cheat service**. Share text results to compare on the honor system.

Campaign unlocks do not apply to the daily challenge, and daily wins do not skip campaign floors. Storage failures/private browsing never prevent playing, although records may not persist.

## Architecture

```
src/
  main.ts               HTML menus, overlays, touch input, lifecycle and audio settings
  game/
    scene.ts            Phaser scene, fixed-step run state, objectives, abilities and effects
    enemy.ts            Six-personality enemy FSM, pursuit and investigation
    logic.ts            Swept circle collision, LOS, A*, PRNG, score and medal functions
    levels.ts           Five hand-authored maps and their interaction/patrol data
    catalog.ts          Enemy tuning, comedy, events, ability and achievement definitions
    fun.ts              Pure deterministic HR timing game and reward rules
    progression.ts      Versioned LocalStorage, personal bests, unlocks and settings
    types.ts            Shared typed data contracts
  art/art.ts            Original pixel sprites and office renderer; static art is baked once
  audio/audio.ts        Original WebAudio sequencer, synthesizers, foley and mix controls
  ui/fun-ui.ts          Accessible, keyboard/touch HR activity with cleanup-safe timers
  ui/style.css          Responsive non-overlapping information rail, map and control dock
  ui/fonts.css          Self-contained font faces; no external font requests
scripts/standalone.mjs   Inlines Vite's tested output into a single portable HTML file
```

The default renderer is Phaser Canvas: for this asset style it is fast, reliable and does not need WebGL. Large static illustrations are baked into one floor texture. Dynamic sight cones are ray-clipped to collision geometry. Pathfinding is refreshed at bounded intervals instead of on every frame. No external game assets are fetched.

`window.__office` is a read-only QA snapshot, not a save editor. A separate positioning helper exists **only** in Vite development mode when opened with `?qa=1`. Vite removes it from production. It is used transparently by some browser integration tests; see below.

## Tests and actual playtesting

```sh
npm test                       # Vitest logic, maps, saves and enemy FSM
npx playwright install chromium
npm run test:browser           # Browser input, UI and integration smoke tests
npm run build
npm run test:release           # Offline, self-contained release; desktop + two touch viewports
npm run test:campaign          # Complete all five floors with real inputs, no QA positioning
```

On a machine with an existing Chromium, optionally set `CHROMIUM_PATH` to its executable. Otherwise Playwright uses its managed browser. The browser config starts Vite automatically.

The shipped test suite includes:
- 325 executed unit/data tests: seeded RNG and UTC dates, geometry, anti-tunnelling collision, line of sight/FOV, A* clearance, scores/medals, storage and achievement deduplication, reachable map objectives with gates closed, valid enemy routes, detection grace, hiding/search transitions, hearing, call-specific immunity, gossip broadcasts, VPN stuns, calendar protection, distraction expiry and intern speed.
- 20 executed Chromium browser journeys: menu and settings persistence, floor locks, achievements, collision and movement, pause/restart, a full first-floor escape using **only real keyboard movement** (no teleports), recovery and hiding, actual ability timers and effects, failure/retry, all four remaining floors' objective/exit rules, rare WFH victory, daily challenge and portrait mobile controls.
- The isolated integration tests for floors 2–5 use development-only QA positioning. Separately, a full five-floor campaign traversal was executed against the production HTML using only movement and ability keys, with no QA positioning. Its automated controller has authored-map knowledge and opportunistically uses abilities; it is not described as a human difficulty study. All five layouts also pass collision-aware reachability tests.
- Seven added browser journeys verify disjoint HUD/map/control bounds at four viewport sizes, HR practice scoring, in-world rewards/pausing, and failure consequences. Thirty pure HR timing/reward tests are included in the unit total.
- Three additional packaged-release checks ran offline from the self-contained HTML: a full desktop keyboard escape, portrait joystick + coffee, and landscape joystick + coffee. No JavaScript errors; the mobile canvas matched its stage dimensions.
- Desktop 1280×900, mobile portrait 390×844, and landscape 844×390 visual checks. Public HTTPS startup, movement and a narrow 390×844 pause dialog were also verified in an independent browser. Real physical iOS/Android hardware has not been tested.

See `QA-REPORT.md` for final execution counts, release checks and known limitations. Browser traces/screenshots are retained only on failures and are not committed.

## Deploy free to GitHub Pages

The same repository now contains a ready-to-publish docs folder. No additional repository, external account, workflow permission or API token is needed for branch-based publication.

1. Open this repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main**, folder **/docs**, then **Save**.
4. GitHub will display the actual HTTPS address when the Pages build completes. Open that returned address and verify CLOCK OUT, movement, HR FUN FRIDAY and pause.

The connected GitHub integration can commit the source and production files, but it does not expose Pages administration and the browser session is not signed in. This one-time owner setting remains pending; no GitHub Pages URL or deployment success is invented. Do not change repository visibility without the owner’s separate consent if GitHub requires it.

Future source changes: run npm run build, test the game, and commit the regenerated docs/index.html together with source. GitHub Pages will republish that branch automatically once enabled. The self-contained Pages file avoids repository-subpath asset failures.

## Optional: Cloudflare Pages

Cloudflare is not connected in the build environment, so no Cloudflare production deployment is claimed.

### Git integration (recommended)

1. Sign in to Cloudflare Dashboard and open **Workers & Pages → Create application → Pages → Connect to Git**.
2. Select `rohanreddymelachervu/The-Great-Corporate-Escape-` and branch `main`. Do not create a second repository.
3. Framework preset: **None**. Root directory: repository root.
4. Build command: `npm ci && npm run build`.
5. Build output directory: `dist`. Set `NODE_VERSION` to `22` if Cloudflare does not select it automatically.
6. Deploy. Open the HTTPS `pages.dev` address Cloudflare actually returns and test CLOCK OUT, movement, sound, pause and the daily challenge. No secrets or backend bindings are required.

### Direct upload

Build locally using `npm ci && npm run build`, or use the accompanying production archive. In Cloudflare Pages, create a **Direct Upload** project and upload the contents of `dist`, ensuring `index.html` is at the upload root. There is no need to upload source or `node_modules`.

If you already use Wrangler on your own machine:

```sh
npx wrangler login
npx wrangler pages deploy dist --project-name the-great-office-escape
```

Wrangler authentication remains on your machine. Do not put API tokens in the repository or chat. `wrangler.toml` declares the static output directory, not credentials.

Any ordinary static HTTPS host can serve `dist`. The single-file `release/office-escape.html` can be used for a portable initial release. Use a host's returned production address, not a Vite development URL.

## Assets and licensing

- Original programmatic office art, sprites, dialogue, level layouts, sound effects and music were created for this game; no image or audio CDN is used.
- Application source is MIT licensed; see `LICENSE`.
- Phaser 3 is MIT licensed, © Photon Storm Ltd. Its distributed license banner remains in the production JavaScript; see `licenses/Phaser-MIT.txt`.
- Embedded Barlow Condensed (Google Fonts / Jeremy Tribby) and IBM Plex Mono (IBM) are distributed under SIL Open Font License 1.1. Full notices are retained in `licenses/`.
- npm build/test tools are development dependencies, not runtime services. Their license metadata remains in `package-lock.json` and installed packages.

## Honest limitations

This is a compact indie arcade release, not a long narrative RPG. Optimal, map-aware routes can clear individual floors in roughly 9–20 seconds, so the requested 1–4 minute pacing is not enforced; exploratory and collectible runs take longer. Its sprites have movement bob/flip animations rather than full multi-frame directional animation sheets. Some furniture is decorative and room labels are intentionally restrained for readable stealth. Audio and mobile integration were tested in Chromium, not every browser/device. Share-sheet and clipboard permissions can vary; a selectable text fallback is provided. Progress belongs to each browser/origin, so it does not transfer between an embedded preview, public host and different devices. Daily scores are comparable starting conditions, not a verified online competition. No Cloudflare deployment is claimed until an authenticated account deploys it.
