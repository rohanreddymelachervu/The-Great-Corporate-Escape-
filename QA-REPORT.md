# Ruleset 2.0 — Gameplay Overhaul QA

30 October 2026. This release responds to the player's feedback that the old game was too passive, simple and unclear.

## What was wrong

The old map-aware routes could finish in 9–18 seconds. The old random-event clock often waited 22 seconds before introducing interference. Most enemies could not catch normal movement, and a coffee throw could hard-disable a whole group. Fixing HUD overlap and adding a separate rhythm activity did not address that core loop.

## What was rebuilt

- No compulsory badge/switch errands. The engineer already has ID.
- Call the lift with E, survive an active office hunt, board during the ten-second door window.
- Lift waits: 20, 26, 30, 34 and 38 seconds. Missing it produces another fourteen-second arrival, not an instant loss.
- Early, seeded interference with visible warning periods: moving HR photo sweeps, meeting circles, intern yap, paperwork paths and founder all-hands.
- Real short directional dodge on Space / DASH, with stamina cost, cooldown, wall collision and actual hazard-avoidance scoring.
- HR on the first floor, recognisable balloons, a stopped/locked-aim photo telegraph, non-homing charge and recovery window.
- Faster and more reliable pursuit; nearby colleagues notice the player instead of simply walking through their body.
- Coffee affects at most two colleagues and cannot blind a close visible pursuer. Immunity tools are brief, hiding expires after six seconds, sprint exhaustion no longer jitters.
- Optional sabotage reduces lift wait, cancels matching hazards and distracts the relevant nuisance. WFH remains a genuine alternative route.
- Clear verb-based current objective and countdown, quick play into the HR floor, separated HUD/map/control regions, preserved unlocks/settings and separate ruleset-2 score keys.
- Failed-run restart preserves the opening seed so players can learn a tell rather than depend on rerolling.

## Executed functional checks

### TypeScript and production packaging — PASS

`npm run build`: strict TypeScript check, Vite production output, self-contained offline HTML and the same GitHub Pages docs build. Expected large-bundle warning is retained because Phaser and fonts are bundled, not requested from runtime CDNs.

Final portable/Pages game: **1,936,055 bytes**.
SHA-256: **c43d781cacca4e15b4264f12a2c302796aa7779d3406f6442342168f51df15e7**.

### Unit/data tests — 460 PASS

| Suite | Tests | Focus |
|---|---:|---|
| levels | 193 | Five distinct maps, reachable lift/tools/loot with gates closed, legal patrol routes, HR on first floor, no mandatory fetch list |
| logic | 100 | RNG, UTC date, collision, anti-tunnelling, LOS, FOV, A*, score, saves and progress |
| enemy | 72 | Detection grace, searching, hearing, calls, personal-space approach, soft coffee, HR tell/locked aim/charge, dash contact, wall blocking and cooldowns |
| director | 63 | Seeded waves, warnings before hits, damage once per incident, dash vs shield, hiding, cover, VPN, lift/boarding cycles and optional time reduction |
| HR rhythm | 30 | Timing window, scoring, five rounds, rewards and failure |
| ruleset migration | 2 | Old unlocks/records preserved; new campaign/daily scores separated |

### Browser journeys — 21 PASS

Actual Chromium journeys verify:
- The menu's call → dodge → board instructions and real HR-floor quick play.
- WASD and arrows, keyboard Space dodge, stamina/cooldown and wall collision.
- Calling the lift without fetch prerequisites, waiting instead of instant victory, true pause and restart.
- Visible warning time before a hazard can damage the player, and actual consequences for camping.
- Dodging a real moving photo sweep earns credit without taking its damage.
- HR visibly locks aim and a real keyboard dodge avoids her lunge.
- Actual lift countdown/boarding integration. That isolated test uses QA positioning between areas; it is not passed off as a no-cheat playthrough.
- Six-second hiding and re-entry cooldown; optional sabotage actually reducing lift arrival.
- Brief ability effects, coffee recovery, genuine WFH victory, 100-BS loss and instant retry.
- Settings persistence, UTC daily challenge, portrait touch movement/DASH/coffee.
- Four disjoint-region layout checks at 1280×900, 960×640, 390×844 and 844×390.
- HR activity practice, live rewards/pausing, failure consequences and single-use booths.

A real input bug was found: the document's Space prevention caused Phaser to ignore keyboard dodges; arrow keys were vulnerable to the same ordering. Space is now handled before default prevention, arrows use Phaser capture, and both paths are explicitly tested. This was fixed rather than weakening movement assertions.

### Offline packaged release — 3 PASS

With browser networking disabled, loaded the production HTML from file and exercised desktop, portrait touch and landscape touch. Actual dodges moved the player; coffee consumed a charge; pause stopped simulation; canvas fit the viewport; there was no page overflow and no JavaScript error. The production QA positioning helper was absent.

### Complete production campaign — 5 FLOORS PASS

Played the final portable production HTML using real movement, dodge, interaction and ability inputs. No positioning, health, clock or win-state mutation was available or used. The controller has authored-map knowledge and reads the exposed read-only snapshot, so this is an automated completion check, not a human fun study.

| Floor | Seconds | Final BS | Sightings | Hits | Actual dodge credits | Route |
|---|---:|---:|---:|---:|---:|---|
| Quick Sync | 29.7 | 12 | 0 | 1 | 1 | Lift |
| Mandatory Fun Friday | 33.6 | 24 | 2 | 2 | 0 | Lift |
| Yappening | 40.8 | 42 | 2 | 3 | 1 | Lift |
| All-Hands Ambush | 41.8 | 0 | 3 | 0 | 0 | Lift |
| Founder Mode | 45.7 | 65 | 6 | 4 | 1 | Lift |

All five succeeded on the first attempt in this final run. Earlier tuning runs included an actual floor-four 100-BS loss close to the elevator's arrival; the controller was then improved to evade nearby pursuers rather than stand still at the doors. The campaign script permits at most three recorded attempts and uses actual optional sabotage on a retry; it does not silently grant immunity or hide failed attempts.

## Distribution

The tested production bytes are written to `docs/index.html` with `docs/.nojekyll` for the existing repository's main/docs deployment. Source and rebuilt docs are to be pushed to that same repository. The user is handling redeployment; this task does not change hosting settings or invent a GitHub Pages URL. The existing Hyperagent preview can be updated in place for immediate testing.

## Limits

- Automated completion and readable tells do not prove that every person will enjoy the balance. Human playtesting remains valuable.
- The map-aware controller's roughly 30–46 second clears are faster than exploratory play. This is a compact arcade-stealth game, not a long narrative RPG.
- Physical iOS/Android devices, Safari and Firefox remain untested; touch checks use Chromium emulation.
- Local saves and honor-system daily scores remain local. No server leaderboard, cloud save or anti-cheat service.
- Pixel characters retain bob/flip animation with added dash ghosts and charge effects, not full directional animation sheets.
