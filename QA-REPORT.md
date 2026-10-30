# Version 1.1 QA — Readable Layout + HR Fun Friday

Updated 30 October 2026 in response to the user's overlap/readability feedback.

## Current verified release

- Updated existing preview: https://hyperagent.com/s/0RA76fgitXB1NI7B7D0-mA
- GitHub Pages-ready build: docs/index.html and docs/.nojekyll in the same repository.
- Pages publication is pending owner authentication / enabling main /docs. No Pages URL is claimed.
- The Pages HTML exactly matches the tested offline game. SHA-256: fb6ae57098639e4cd3e623a6dc3c1d570645498a37e964a82c1efad891fd0f6a.

## Changed and exercised

- Separate layout regions for map, current objective/status rail, notification/dialogue area and controls.
- One current objective and one nearby NPC speaker. Full map speech bubbles removed; only two nearby short NPC labels remain.
- Only unlocked abilities appear. Touch controls stay outside the game viewport, not over characters or objectives.
- Automatic canvas resize following rail/layout changes. Mobile cameras clamp to the actual office, without a blank control-overlap area.
- Real HR five-beat activity accessible immediately in the menu and as optional booths on floors 2, 4 and 5.
- Start button lets the player read before timing begins. Green target display matches the actual scoring window. Three hits grant -25 BS, +1 coffee, 12s HR distraction and accuracy points; failure adds 8 BS. Booths cannot be farmed.
- Fixed a timing-marker reset race found in browser tests. Activity key listeners and animation frames are cleaned up when closing or changing screens.

## Executed final checks

- Production TypeScript + Vite + standalone/Pages packaging: PASS.
- **325 unit/data/FSM tests passed**: 100 logic, 178 level/data, 17 enemy FSM, 30 HR activity tests.
- **20 browser journeys passed**: original 13 plus four no-overlap viewport checks and three actual HR activity success/failure/reward tests.
- Geometry checks: 1280×900, 960×640, 390×844 portrait touch, 844×390 landscape touch. HUD, map and control rectangles are disjoint; current-objective font >=11px; ability targets >=44px; no horizontal page overflow; canvas matches its viewport within one pixel.
- **Three offline production checks passed**: complete keyboard escape and both touch orientations; zero JavaScript errors.
- **All five production floors completed again** with real movement/ability inputs and no QA positioning. Times: 11.5, 8.6, 16.8, 14.2, 17.1 game seconds. The automated controller has authored-map knowledge; these are not a human fun/difficulty study.
- Published preview artifact version 4: render health PASS, zero console errors and zero failed requests. The hosted HR activity opened with the correct host, timing rail and Start Activity button.

## Remaining limitations

- GitHub Pages still requires its one-time owner publishing-source setting. Repository write access does not imply Pages administration or browser sign-in.
- Physical mobile hardware and Safari/Firefox remain untested. Compact portrait/landscape status rails may scroll for unusually long messages, rather than overlap the map.
- Optimal map-aware runs remain very short; additional human pacing/difficulty testing is still useful.
- Local progression and honor-system daily scores remain unchanged. No backend or online leaderboard.

---

## Historical version 1.0 QA record

# Release QA — The Great Office Escape: 4:59 PM

Release date: 30 October 2026.

## Shipped result

- Public initial game: https://hyperagent.com/s/0RA76fgitXB1NI7B7D0-mA
- Source repository: https://github.com/rohanreddymelachervu/The-Great-Corporate-Escape-
- Stack: Phaser 3.90, strict TypeScript, Vite, client-side Canvas and WebAudio.
- Five distinct hand-authored maps, six enemy personalities, six abilities, seeded daily challenge, local progression, medals, 12 unlockable achievements, original pixel art, original synthesized soundtrack, desktop and touch controls.
- Standalone release: 1,901,384 bytes including engine, fonts and third-party license notices. No runtime network requests are needed for the game itself.
- Standalone SHA-256: `3c6051c345840c7b41cd40a3d101e4e7e928a61834c1318af0d650d7d6a9ea34`.

## Executed checks

### Production build — PASS

`npm run build` runs TypeScript checking, a Vite production build and self-contained packaging. The expected large-bundle warning is not suppressed: the Phaser engine is intentionally bundled rather than fetched from a CDN. The production build removes the development-only QA positioning helper.

### Unit/data tests — 289 PASS

`npm test` executed:

| Suite | Passing tests | Scope |
|---|---:|---|
| logic.test.ts | 100 | PRNG, UTC dates, collision, LOS, FOV, A*, scoring, medals, storage, progression and achievement deduplication |
| levels.test.ts | 172 | Five unique maps, closed-gate reachability, objective/item/interaction/exit access, valid geometry, patrol clearance, enemy progression and spawn separation |
| enemy.test.ts | 17 | Detection grace, walls, search/return, sprint hearing, call immunity differences, calendar protection, camouflage, VPN freeze, gossip broadcast, distraction expiry, catch cooldown and intern speed |

### Chromium browser journeys — 13 PASS

`npm run test:browser` executed on the final source using Chromium 156. Viewport: 1280×900 unless mobile-specific.

1. Menu, survival guide, floor locks, achievements, sound settings and persistence.
2. Keyboard movement, wall collision, coffee charge use, true pause and restart reset.
3. **Full first-floor escape using actual keyboard movement only.** No QA positioning or completion hook. Recovered the badge, activated the required switch, walked to the elevator, earned Ghost Employee, unlocked achievements and advanced to floor 2.
4. Hiding, BS recovery at coffee station and movement cancelling hiding.
5. Real ability timers, movement cancelling Slack camouflage, VPN freezing enemy positions and calendar activation.
6. Reaching 100 BS triggers the game-over screen; retry restores the run.
7–10. Floors 2, 3, 4 and 5 each enforce their actual badge/switch/elevator win conditions. These tests explicitly use a development-only positioning helper to isolate integration rules.
11. Rare WFH pickup, approval ability, alternate exit and achievement.
12. Deterministic daily date/seed presentation and honest local-only score description.
13. 390×844 touch viewport: joystick movement, coffee button, responsive layout and no horizontal page overflow.

### Offline packaged-release checks — 3 PASS

`npm run test:release` loaded the final single HTML file using `file://` with the browser context set **offline**, not from the Vite server:

| Viewport | Executed interaction | Result |
|---|---|---|
| 1280×900 desktop | Full first-floor escape with actual keyboard movement | Victory; no JavaScript errors |
| 390×844 portrait touch | Joystick movement + coffee activation | Moved 67.5 world pixels; cup consumed; Canvas exactly matches stage; no errors |
| 844×390 landscape touch | Joystick movement + coffee activation | Moved ~69.8 world pixels; cup consumed; Canvas exactly matches stage; no errors |

This confirms that the game engine, font data, procedural art and audio implementation do not depend on the development sandbox or a runtime CDN.

### Complete production campaign — 5 FLOORS PASS

A separate automated controller completed every floor in sequence in the final production HTML. It read the exposed read-only snapshot, planned collision-aware paths from the authored maps, and used real keyboard movement, sprint, interaction and ability inputs. It did not use QA positioning, a win hook or modified save data.

| Floor | Game seconds | BS / catches / sightings |
|---|---:|---|
| The Quick Sync | 11.6 | 0 / 0 / 0 |
| Mandatory Fun Friday | 8.7 | 0 / 0 / 0 |
| The Yappening | 17.1 | 0 / 0 / 0 |
| The All-Hands Ambush | 13.3 | 0 / 0 / 0 |
| Founder Mode | 16.8 | 0 / 0 / 0 |

The controller deliberately knows the map and activates defensive abilities when enemies approach. This proves real-input campaign completion and progression, not human-level difficulty or guaranteed fun. The very short optimal times are an honest pacing limitation. Command: `npm run test:campaign`. No JavaScript errors occurred.

### Independent hosted checks — PASS

- Published game opened in a separate browser session using the webpage artifact, not localhost.
- CLOCK OUT started The Quick Sync with the correct objectives.
- Keyboard events moved the player from x=90 to x=198.5; the production QA helper was absent.
- The actual public HTTPS sharing URL loaded without requiring the player's account and CLOCK OUT launched the game.
- Public game's iframe was resized to 390×844. The pause dialog fit with readable text and accessible controls; pause worked.
- Final webpage version 3 passed its render health check: **zero console errors and zero failed resource requests**. CLOCK OUT was clicked again on version 3 and the objective HUD appeared.

The local sandbox's HTTP firewall does not permit fetching Hyperagent public pages from its own Chromium process. Public verification was therefore performed through the independent browser tools, not misrepresented as a successful local Playwright public-URL run.

## Bugs found and fixed before release

- Software WebGL rendering was slow in the test browser. Switched to Phaser Canvas and baked static artwork once per floor; input then advanced at the intended speed.
- Scene clocks and PRNG decisions varied with rendering cadence. Added a fixed 60 Hz simulation step.
- Duplicate achievement IDs in one earned batch could duplicate saved achievements. Deduplicated before writing.
- The browser test runner and Vitest initially both collected browser specs. Added an explicit unit-test include configuration.
- A full playthrough test continued walking toward a coordinate after an earlier valid elevator victory. Fixed the test to recognize the actual terminal state; gameplay had already succeeded.
- Menu-height changes did not immediately resize the canvas on mobile. Explicitly synchronized game and stage dimensions.
- Landscape touch cameras made the whole map too small. Added a following camera with larger characters.
- Initial mobile toast covered the player. Moved portrait notifications above the action area.
- Closing help/floor dialogs after failure could leave a dead run without result controls. Restore the result screen.
- Portable HTML initially executed before the body existed. Preserved module startup behavior.
- The publication host injected HTML at a literal closing-body string inside bundled Phaser code. Escaped bundled HTML closing tags while preserving JavaScript semantics; subsequent hosted render checks passed.
- Diagonal coffee throws were shorter than cardinal throws. Normalize facing independently of movement input.

## Limits and unverified areas

- No Cloudflare account was connected, so **no Cloudflare Pages deployment is claimed**. A verified public Hyperagent release is available, and the archive includes `dist`, `wrangler.toml`, asset notices and precise Pages deployment instructions.
- No physical iOS/Android devices or non-Chromium engines were tested. Responsive touch emulation passed in both orientations.
- All five floors now have full automated real-input production playthroughs, plus reachability and integration tests. No human playtest study was performed. More human difficulty tuning remains valuable, especially because an optimal map-aware controller can escape very quickly.
- Character animation uses expressive sprites, movement bob and facing flips rather than full directional animation sheets. Static monitor artwork is not a fully animated per-monitor scene.
- Daily competition is honor-system, per-browser LocalStorage; there is no online leaderboard, anti-cheat service, cloud save or cross-device synchronization.
- Share/clipboard support depends on browser permissions; text fallback remains available. Audio generation was exercised without console errors; speaker output was not validated on physical devices.
- Compact arcade maps favor quick retry and replay rather than long-form narrative content. The map-aware campaign controller cleared every floor in 9–18 seconds. The requested 1–4 minute pacing is not enforced; exploratory and optional-collectible play takes longer.
