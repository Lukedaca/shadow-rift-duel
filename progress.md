Original prompt: Vytvoř originální bojovou hru ve stylu mortal kombat, stáhni si i animace...atd na netu vše co budeš potřebovat, neudělej žádné chyby ! Používej své superpowers když nebudeš vědět, dej tam i zvuky..atd !

2026-03-06
- Project initialized in `C:\Users\Intel\shadow-rift-duel`.
- Goal: build an original browser fighting game inspired by 90s arena fighters, using downloaded permissive sprite assets plus custom gameplay/audio.
- Constraint: keep work isolated because `C:\Users\Intel` git worktree is heavily dirty and unrelated.
- Downloaded sprite packs:
  - `cat_ani_0.zip` from OpenGameArt (Cat Fighter Sprite Sheet, Joe Williamson, CC-BY 3.0)
  - `mon1_ani.zip` from OpenGameArt (Cute Monster Sprite Sheet, Buch, CC-BY 3.0)
- Implemented:
  - standalone HTML/CSS/JS fighter with rounds, timer, HP bars, meter, pause, fullscreen, AI toggle
  - Nightclaw vs Mawshade matchup with light/heavy/special attacks, projectiles, particles, combo counters
  - synthetic WebAudio fight sounds and deterministic hooks `window.render_game_to_text` + `window.advanceTime`
  - local static server `server.js` and project metadata in `package.json`
- Bugs fixed during validation:
  - menu HUD crash before fighters existed
  - start button focus causing `Space` to restart the match during combat tests
  - blue sprite-sheet backgrounds removed via runtime chroma-key drawing
- Validation completed:
  - `node --check game.js`
  - `node --check server.js`
  - Playwright client loop with screenshots in `test-artifacts`
  - focused Playwright interaction tests verifying movement, light/heavy attacks, special meter cost, projectile hit flow, and KO progression
- Remaining caveat:
  - browser test automation required unsandboxed execution because Chromium launch is blocked inside the sandbox on this machine.

2026-03-06 - overhaul pass after user feedback
- User-reported issues addressed:
  - arrow keys were scrolling the page instead of being captured purely as game input
  - the shell looked too much like a generic app layout
  - placeholder cat / monster art was replaced with actual fighter animation reels
- Reworked presentation:
  - `index.html` and `style.css` rebuilt into a full-screen arcade cabinet layout with marquee header, versus card, integrated command deck, and viewport-safe sizing
  - page now forces `overflow: hidden` and keeps the command dock visible inside the viewport on desktop
- Reworked fighter art:
  - switched active build to `SumoHulkBrawler_byEris.zip` animation gifs from OpenGameArt
  - both fighters now use dedicated brawler animation states (`idle`, `walk`, `jump`, `punch`, `kick`, `fall`) with separate palette filters for Raze Vale and Vex Dray
  - canvas rendering now uses transparent gifs directly instead of the old blue-background chroma-key path
- Gameplay / engine adjustments:
  - added explicit `preventDefault()` handling for game keys (`WASD`, arrows, `Space`, `Enter`, `P`, `F`, etc.)
  - renamed matchup to `Raze Vale` vs `Vex Dray`
  - fixed combo text alignment so left/right hit-chain labels track the correct fighter slot
- Validation completed after overhaul:
  - `node --check game.js`
  - `node --check server.js`
  - Playwright client run with fresh artifacts in `test-artifacts-final`
  - focused Playwright check confirmed `window.scrollX === 0` and `window.scrollY === 0` before and after `ArrowRight`
  - focused Playwright layout measurement confirmed the command dock is visible within a `1600x1100` viewport after CSS sizing changes
  - screenshots reviewed:
    - `test-artifacts-refresh/page-shell-2.png` for full-page cabinet layout
    - `test-artifacts-final/shot-0.png` for in-fight sprite visibility and HUD state

2026-03-06 - second redesign pass after harsher visual feedback
- Active art direction changed again:
  - retired the `SumoHulk` build and promoted `streets_of_fight_files.zip` as the live character and stage pack
  - kept `Brawler Girl` and `Enemy Punk` as the active reel pair because they are genuine side-view human fighters
- Major visual changes:
  - rebuilt the shell into a pirate-broadcast cabinet frame with marquee header, status rack, operator deck, and much less app-like chrome
  - increased fighter scale and rewrote attract mode so menu state cycles real move animations instead of static posing
  - replaced the previous broad stage card with a layered neon backlot: billboards, fence lattice, road perspective, searchlight beams, and smaller center signage
  - replaced the old rectangular HUD with angled health/meter bars and a separate center timer plate
  - rebuilt the menu overlay into a fight-card composition that keeps the stage visible while showing matchup and start prompt
- Validation completed for the redesign:
  - `node --check game.js`
  - `node --check server.js`
  - official `develop-web-game` Playwright client run for menu and in-fight screenshots:
    - `test-artifacts-redesign-final-menu/shot-0.png`
    - `test-artifacts-redesign-final/shot-0.png`
  - inspected `test-artifacts-redesign-final/state-0.json` to confirm live fight state stayed in sync with the render
  - captured full-page shell screenshots with Playwright:
    - `test-artifacts-redesign-shell/page-menu.png`
    - `test-artifacts-redesign-shell/page-fight.png`

2026-03-06 - facing fix after post-redesign playtest
- Root cause:
  - facing logic itself was updating, but `pushFightersApart()` was still forcing horizontal separation even during jumps
  - that made cross-ups unnecessarily hard and made the opponent appear stuck facing one side in practical play
- Fix:
  - added `faceOpponent()` helper for explicit facing recalculation
  - recompute facing both before and after movement in `applyControlToFighter()`
  - allow airborne side swaps by skipping `pushFightersApart()` while either fighter is off the ground
- Validation:
  - `node --check game.js`
  - regression Playwright client run: `test-artifacts-facing-regression/shot-0.png`
  - forced side-swap render check confirmed the sprite mirrors correctly once positions are swapped:
    - `test-artifacts-facing-swap/forced-swap.png`
  - live cross-up test with nearby fighters confirmed real gameplay side swapping now updates facing correctly:
    - `test-artifacts-facing-swap/live-crossup.png`
    - `test-artifacts-facing-swap/live-crossup-state.json` showed `Nova Hex` on the right with `facing: -1` and `Riot Voss` on the left with `facing: 1`

2026-03-06 - deploy prep for GitHub and Vercel
- created local standalone git repository in `C:\Users\Intel\shadow-rift-duel`
- added deploy hygiene files:
  - `.gitignore`
  - `.vercelignore`
  - `README.md`
- copied only the active runtime art subset into `assets/runtime/streets-of-fight`
- updated `game.js` to load from `assets/runtime` so deploys no longer depend on the bulky exploration asset tree

2026-03-06 - publish pass
- local git release committed as `1a4ddb8 Initial Shadow Rift Duel release`
- GitHub repository created and pushed:
  - `https://github.com/Lukedaca/shadow-rift-duel`
- Vercel production deployed successfully:
  - `https://shadow-rift-duel.vercel.app`
- live production check passed in a real browser session after deploy

2026-03-06 - enemy sprite orientation hotfix
- user reported that the opponent still visually read as facing away even though gameplay-facing values were updating
- root cause: `Enemy Punk` needed a different render baseline than `Brawler Girl`
- fix:
  - added per-fighter `spriteFacing`
  - set `Riot Voss` to `spriteFacing: -1`
  - updated `drawFighter()` to render with `fighter.facing * fighter.spriteFacing`

2026-03-06 - audio hotfix
- user reported missing sound effects in practical play
- root cause:
  - synth effects existed in code, but `AudioContext` unlock flow was too fragile and could remain effectively silent in browsers that required an explicit resume path
  - the game also lacked enough immediate audible feedback around non-hit interactions
- fix:
  - made `audio.unlock()` resilient with `resume()` support and reuse of a single unlock promise
  - increased master gain slightly
  - made `startGame()` await audio unlock before starting the round
  - added audible UI/start, attack whoosh, jump, land, and pause/resume effects
- validation:
  - `node --check game.js`
  - browser runtime check confirmed `AudioContext` state transitions:
    - before start: `ready=false`, `state=none`
    - after start: `ready=true`, `state=running`
    - after actions: `ready=true`, `state=running`

2026-03-06 - pronounced sample-based audio pass
- user requested much stronger sound effects plus retro background music and explicitly allowed downloading assets from the internet
- source packs downloaded from OpenGameArt with clear CC0 licensing:
  - `Thwack Sounds` by Jordan Irwin (AntumDeluge)
  - `50 CC0 retro synth SFX` by rubberduck
  - `8-bit Theme - On The Offensive` by Wolfgang_
- local runtime subset created under `assets/audio/runtime`:
  - impact WAVs for light/heavy/block/land
  - retro synth OGGs for whooshes, UI, jump, special, round-start, and win cues
  - looped retro music track `backlot-brawl.ogg`
- engine changes:
  - rewired `AudioEngine` to preload pooled HTML audio voices for downloaded samples while keeping WebAudio tones/noise as fallback accents
  - added looped music playback with state-aware volume sync (`menu`, `intro`, `fight`, `outro`, `pause`)
  - exposed richer debug data through `render_game_to_text` and `window.shadowRiftAudio`
  - preloaded audio alongside sprite warmup so the first started round already has the full runtime mix
- repo/deploy hygiene:
  - added `assets/audio/_downloads` and `assets/audio/_packs` to `.gitignore` and `.vercelignore`
  - only `assets/audio/runtime` is intended to ship
- validation:
  - `node --check game.js`
  - `node --check server.js`
  - official `develop-web-game` Playwright client run completed after the audio refactor; `output/web-game/state-0.json` showed:
    - `audio.ready=true`
    - `audio.externalReady=true`
    - `audio.musicReady=true`
    - `audio.musicPaused=false`
    - `audio.musicVolume=0.34`
  - screenshots reviewed:
    - `output/web-game/shot-0.png`
    - `test-artifacts-audio-runtime/audio-runtime.png`
  - targeted runtime probe `test-artifacts-audio-runtime/audio-runtime.json` confirmed:
    - music source switched to `assets/audio/runtime/music/backlot-brawl.ogg`
    - music playback advanced to `3.576s`
    - heavy hit, projectile/special, special whoosh, pause, and resume sample pools all registered real playback
  - targeted coverage probes confirmed additional branches:
    - `test-artifacts-audio-coverage/audio-coverage.json` showed `land` and `whooshLight`
    - `test-artifacts-audio-coverage-locked/audio-coverage-locked.json` showed `jump`, `land`, `whooshLight`, and `whooshHeavy`
  - no new browser console errors were reported in the probes
