# Office Heist v2.1 — Expanded World, Loot and Hit Scenes

Release prepared 31 October 2026 for the existing repository's main/docs redeployment. Hosting settings are not changed.

## Delivered changes

- Five 1600×1120 worlds: twice the old floor area, with connected east/south annexes, lounges, pantry areas and service corridors.
- Ten enclosed meeting rooms with real walls, open 120px doorways and seeded traffic schedules. Attendees physically walk out and back, warn through amber lights, notice the player and alert major enemies. Contact can trigger a one-quick-question interruption.
- Forty-five new optional loot objects, plus the existing laptops: TVs, snacks, mechanical keyboards, plants, trophies and coffee machines. Hold E/ACT for timed steals; moving, releasing or leaving range cancels incomplete theft. Snacks are an immediate tap.
- A run-local bag, visible carried TV, actual movement/awareness risk from bulky equipment, local theft alarms and bank-on-escape scoring. Losses do not save bag points; duplicate claims cannot farm value.
- Eight original animated hit cutaways: photo, calendar meeting, intern AGENT chain, printer paper burial, founder all-hands, PM scope growth, gossip broadcast and doorway interruption.
- Brief mode is about 1.3–1.6 seconds; Long haul is about 3.3–3.8 seconds. The world/lift/score clock pauses, then resumes automatically. E/Space/Enter/Escape or Skip can return early after 250ms. Reduced motion suppresses flashes. Fatal hits finish their scene and then reach the actual game-over screen rather than leaving the scene paused.
- Larger-world route hints follow reachable passageways. Distant meeting announcements are suppressed rather than overwriting immediate feedback. The established call → survive → board loop remains intact; loot is never a compulsory fetch quest.

## Actual executed checks

### Production build — PASS

`npm run build` runs strict TypeScript, Vite and self-contained/Pages packaging. Large-chunk warning is expected because Phaser and fonts are bundled, not fetched at runtime.

Portable game and `docs/index.html`: **1,974,790 bytes**.
SHA-256: **046d3091c99e69db878e8501678b58527d57573bb6b3e62e6e58f70fa969c6c6**.

### Unit/data suites — 707 PASS

| Suite | Passing checks |
|---|---:|
| Five expanded maps, geometry, loot access and meeting-room routes | 388 |
| Collision, LOS, navigation, score, storage and RNG | 100 |
| Enemy behavior and locked-aim HR charges | 72 |
| Seeded interference and lift clocks | 63 |
| Meeting traffic, physical walkout/return, detection, protection and collisions | 32 |
| HR rhythm activity | 30 |
| Loot bag, values, carrying penalties, held theft and cancellation | 20 |
| Existing-progress/ruleset score separation | 2 |

Old hardcoded 1120×800 bounds in one director test were replaced with each actual level's width/height, not relaxed to ignore out-of-bounds values. The save-default assertion now explicitly includes Brief hit scenes. Strict closed-gate reachability and collision checks remain in place.

### Chromium browser journeys — 38 PASS

Includes all previous escape/input/ability/collision/pause/retry/daily checks and:
- All eight hit kinds rendered real changing animation frames, applied damage once, froze the office clock and auto-resumed.
- Long-haul preference persisted. Skipping did not leak a Space dodge or E interaction into gameplay.
- A lethal founder interruption completed before the real loss screen; retry stayed usable.
- A held TV steal awarded 800 points once, increased carrying weight and displayed the actual 9% penalty; Slack refusal was meaningful and clearly explained.
- Release/movement cancelled partial theft without rewarding it.
- Snacks restored BS. Escaping banked bag value exactly once and unlocked the snack achievement; a failed escape did not save the bag score.
- Actual meeting attendees completed walkout, spotted a player and triggered a doorway interruption.
- Touch ACT could steal, and cutaway/Skip bounds were verified at 390×844 and 844×390.
- HUD/map/dock rectangles remained disjoint at 1280×900, 960×640 and both touch orientations.

Focused integration tests use development-only positioning and hit injection to isolate presentation and reward rules; those are not described as no-cheat playthroughs. Helpers are absent in production.

### Offline production smoke — 3 PASS

Loaded the final portable HTML with networking disabled. Desktop and both touch orientations exercised movement, actual dodge, coffee and pause. Canvas dimensions matched the game viewport, there was no horizontal page overflow, no production QA helper and no JavaScript error.

### Complete production campaign — ALL FIVE PASS

Played the portable production game with actual movement/ability/interact inputs, not position, health, clock or win overrides. The controller knows the authored map and reads the read-only snapshot; it is an automated functionality check, not a human fun study. Cutaways were allowed to play and return naturally.

| Floor | Game seconds | Final BS | Sightings | Hits | Dodge credits | Route |
|---|---:|---:|---:|---:|---:|---|
| Quick Sync | 30.7 | 24 | 1 | 2 | 0 | Lift |
| Mandatory Fun Friday | 36.0 | 0 | 0 | 0 | 1 | Lift |
| Yappening | 44.1 | 10 | 3 | 1 | 1 | Lift |
| All-Hands Ambush | 44.0 | 0 | 2 | 0 | 0 | Lift |
| Founder Mode | 48.2 | 52 | 4 | 2 | 0 | Lift |

All succeeded on the first attempt in this final run. Optional loot bank/win/loss behavior is tested separately by the browser journeys rather than falsely claiming the campaign controller stole everything.

## Problems fixed during integration

- Removed obsolete automatic-laptop handling after laptops became actual E/ACT steals.
- Prevented further fixed-step movement/damage while a hit cutaway is active and cleaned up held theft/input on interruption.
- Made fatal-hit pause/resume safe so the delayed loss screen cannot hang.
- Fixed an expanded-map snapshot field name collision between meeting door state and elevator door countdown.
- Limited meeting warning notifications by distance; far-away rooms had overwritten a nearby hiding cooldown message.
- Raised landscape Skip to a real 44px target rather than shrinking it below the touch requirement.
- Kept displayed vision cones consistent with the actual wider awareness caused by bulky loot.
- Updated campaign navigation to actual world dimensions and released/reissued automation inputs after cutaways.
- Clipped decorative major-enemy cones redraw at 20Hz while gameplay and detection remain fixed at 60Hz, reducing the larger map's presentation workload.

## Limits and distribution

Source and the exact tested `docs/index.html` are intended for the same existing main branch. The user handles redeployment. No new GitHub Pages URL or deployment success is invented merely because files were built or committed.

No physical iOS/Android hardware, Safari or Firefox was tested. Human pacing and subjective fun still need feedback. Local saves and honor-system daily scores remain local; no server leaderboard or cloud save. Meeting doorways stay physically open: amber/open states indicate traffic, not a secretly non-colliding closed door. Loot, room routes and every main exit pass collision-aware reachability checks.
