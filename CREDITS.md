# Shadow Rift Duel Credits

This game is an original implementation and ruleset created locally for this project.

Active runtime art assets used in the current build:

- `assets/runtime/streets-of-fight/*`
  Source: https://opengameart.org/content/streets-of-fight
  Title: Streets of Fight
  Artist: CraftPix.net
  License: CC0 1.0
  Note: the repository vendors only the runtime subset actually used by the game.

Active runtime audio assets used in the current build:

- `assets/audio/runtime/music/backlot-brawl.ogg`
  Source: https://opengameart.org/content/8-bit-theme-on-the-offensive
  Title: 8-bit Theme - On The Offensive
  Artist: Wolfgang_
  License: CC0 1.0
  Note: looped as the in-game retro background music layer.

- `assets/audio/runtime/sfx/block.wav`
- `assets/audio/runtime/sfx/hit-heavy-a.wav`
- `assets/audio/runtime/sfx/hit-heavy-b.wav`
- `assets/audio/runtime/sfx/hit-light-a.wav`
- `assets/audio/runtime/sfx/hit-light-b.wav`
- `assets/audio/runtime/sfx/land.wav`
  Source: https://opengameart.org/content/thwack-sounds
  Title: Thwack Sounds
  Artist: Jordan Irwin (AntumDeluge)
  License: CC0 1.0
  Note: the live build vendors a small combat-impact subset from the pack.

- `assets/audio/runtime/sfx/jump.ogg`
- `assets/audio/runtime/sfx/round-start.ogg`
- `assets/audio/runtime/sfx/special.ogg`
- `assets/audio/runtime/sfx/ui-confirm.ogg`
- `assets/audio/runtime/sfx/ui-pause.ogg`
- `assets/audio/runtime/sfx/ui-resume.ogg`
- `assets/audio/runtime/sfx/whoosh-heavy.ogg`
- `assets/audio/runtime/sfx/whoosh-light.ogg`
- `assets/audio/runtime/sfx/whoosh-special.ogg`
- `assets/audio/runtime/sfx/win.ogg`
  Source: https://opengameart.org/content/50-cc0-retro-synth-sfx
  Title: 50 CC0 retro synth SFX
  Artist: rubberduck
  License: CC0 1.0
  Note: the live build vendors a curated subset for UI, movement, attack, and announcer cues.

Local source caches downloaded during audio sourcing and kept out of deploys:

- `assets/audio/_downloads/*`
- `assets/audio/_packs/*`
  Note: these are ignored by GitHub/Vercel; only `assets/audio/runtime/*` ships in the live build.

Archived / downloaded during art exploration, but not used in the current live art build:

- `assets/sprites/streets_of_fight_files.zip`
  Source: https://opengameart.org/content/streets-of-fight
  Title: Streets of Fight
  Artist: CraftPix.net
  License: CC0 1.0

- `assets/sprites/SumoHulkBrawler_byEris.zip`
  Source: https://opengameart.org/content/sprite-sheet-sidescoller-cycles
  Title: Sprite sheet - sidescoller cycles
  Artist: Eris
  License: CC0 1.0

- `assets/sprites/cat_ani_0.zip`
  Source: https://opengameart.org/content/cat-fighter-sprite-sheet
  Title: Cat Fighter Sprite Sheet
  Artist: Joe Williamson
  License: CC-BY 3.0

- `assets/sprites/mon1_ani.zip`
  Source: https://opengameart.org/content/cute-monster-sprite-sheet
  Title: Cute Monster Sprite Sheet
  Artist: Buch
  License: CC-BY 3.0

Other downloaded exploration assets in `assets/sprites` remain in the repository for reference only.

All gameplay code, UI, arena art direction, effects, naming, balancing, and composition in this project were created in this workspace. The live audio mix now uses downloaded CC0 samples layered with local WebAudio synth accents and routing.
