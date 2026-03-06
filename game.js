const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const aiToggle = document.getElementById("ai-toggle");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FLOOR_Y = 610;
const HORIZON_Y = 352;
const STAGE_LEFT = 132;
const STAGE_RIGHT = WIDTH - 132;
const FIXED_STEP = 1 / 60;
const FIXED_MS = 1000 / 60;
const MAX_ROUNDS_TO_WIN = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);

const keyState = {
  held: new Set(),
  pressed: new Set(),
};

const GAME_KEYS = new Set([
  "KeyA",
  "KeyB",
  "KeyD",
  "KeyF",
  "KeyJ",
  "KeyK",
  "KeyL",
  "KeyP",
  "KeyQ",
  "KeyS",
  "KeyW",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Enter",
  "Space",
]);

const loadedImages = new Map();
const makeStrip = (src, frames, fps, frameWidth = 96, frameHeight = 63, loop = true) => ({
  src,
  frames,
  fps,
  frameWidth,
  frameHeight,
  loop,
});

const stageManifest = {
  skyline: "./assets/runtime/streets-of-fight/Stage Layers/back.png",
  foreground: "./assets/runtime/streets-of-fight/Stage Layers/fore.png",
  car: "./assets/runtime/streets-of-fight/Stage Layers/props/car.png",
  barrel: "./assets/runtime/streets-of-fight/Stage Layers/props/barrel.png",
  hydrant: "./assets/runtime/streets-of-fight/Stage Layers/props/hydrant.png",
  banner: "./assets/runtime/streets-of-fight/Stage Layers/props/banner-hor/banner-hor1.png",
};

const fighterSpriteRoot = "./assets/runtime/streets-of-fight/Spritesheets";
const spriteManifest = {
  nova: {
    idle: makeStrip(`${fighterSpriteRoot}/Brawler Girl/idle.png`, 4, 8),
    walk: makeStrip(`${fighterSpriteRoot}/Brawler Girl/walk.png`, 10, 13),
    jump: makeStrip(`${fighterSpriteRoot}/Brawler Girl/jump.png`, 4, 10, 96, 63, false),
    light: makeStrip(`${fighterSpriteRoot}/Brawler Girl/punch.png`, 3, 16, 96, 63, false),
    heavy: makeStrip(`${fighterSpriteRoot}/Brawler Girl/kick.png`, 5, 14, 96, 63, false),
    special: makeStrip(`${fighterSpriteRoot}/Brawler Girl/dive_kick.png`, 5, 16, 96, 63, false),
    block: makeStrip(`${fighterSpriteRoot}/Brawler Girl/idle.png`, 4, 8),
    hurt: makeStrip(`${fighterSpriteRoot}/Brawler Girl/hurt.png`, 2, 12, 96, 63, false),
    ko: makeStrip(`${fighterSpriteRoot}/Brawler Girl/hurt.png`, 2, 4, 96, 63, false),
  },
  riot: {
    idle: makeStrip(`${fighterSpriteRoot}/Enemy Punk/idle.png`, 4, 8),
    walk: makeStrip(`${fighterSpriteRoot}/Enemy Punk/walk.png`, 4, 11),
    jump: makeStrip(`${fighterSpriteRoot}/Enemy Punk/hurt.png`, 4, 7, 96, 63, false),
    light: makeStrip(`${fighterSpriteRoot}/Enemy Punk/punch.png`, 3, 15, 96, 63, false),
    heavy: makeStrip(`${fighterSpriteRoot}/Enemy Punk/punch.png`, 3, 9, 96, 63, false),
    special: makeStrip(`${fighterSpriteRoot}/Enemy Punk/punch.png`, 3, 7, 96, 63, false),
    block: makeStrip(`${fighterSpriteRoot}/Enemy Punk/idle.png`, 4, 8),
    hurt: makeStrip(`${fighterSpriteRoot}/Enemy Punk/hurt.png`, 4, 11, 96, 63, false),
    ko: makeStrip(`${fighterSpriteRoot}/Enemy Punk/hurt.png`, 4, 5, 96, 63, false),
  },
};

const ATTACK_LIBRARY = {
  light: {
    damage: 7,
    startup: 0.08,
    active: 0.08,
    recovery: 0.18,
    range: 92,
    knockback: 230,
    launch: 0,
    meterGain: 8,
    particleCount: 8,
    color: "#ffe6a3",
  },
  heavy: {
    damage: 13,
    startup: 0.18,
    active: 0.11,
    recovery: 0.3,
    range: 118,
    knockback: 380,
    launch: 150,
    meterGain: 14,
    particleCount: 15,
    color: "#ff8759",
  },
  special: {
    damage: 15,
    startup: 0.22,
    active: 0.16,
    recovery: 0.35,
    range: 0,
    knockback: 280,
    launch: 110,
    meterGain: 0,
    particleCount: 18,
    color: "#6ce4ff",
    meterCost: 38,
    projectileSpeed: 520,
  },
};

const audio = new (class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.ready = false;
  }

  unlock() {
    if (this.ready) {
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    this.ready = true;
  }

  tone(freq, duration, type, gainValue, glide = null) {
    if (!this.ready) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glide) {
      osc.frequency.exponentialRampToValueAtTime(glide, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration, gainValue, playbackRate = 1) {
    if (!this.ready) {
      return;
    }
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = playbackRate;
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  playHit(kind) {
    if (kind === "block") {
      this.tone(180, 0.1, "square", 0.05, 90);
      this.noise(0.06, 0.03, 1.7);
      return;
    }
    if (kind === "heavy") {
      this.tone(120, 0.14, "triangle", 0.09, 52);
      this.noise(0.12, 0.05, 0.8);
      return;
    }
    this.tone(210, 0.1, "triangle", 0.06, 110);
    this.noise(0.08, 0.03, 1.4);
  }

  playSpecial() {
    this.tone(280, 0.24, "sawtooth", 0.08, 620);
    this.tone(150, 0.2, "triangle", 0.05, 90);
  }

  playRoundStart() {
    this.tone(440, 0.12, "triangle", 0.07, 520);
    this.tone(620, 0.18, "triangle", 0.06, 760);
  }

  playWin() {
    this.tone(360, 0.18, "triangle", 0.07, 520);
    this.tone(540, 0.24, "triangle", 0.06, 720);
  }
})();

const state = {
  mode: "menu",
  paused: false,
  aiEnabled: true,
  assetsReady: false,
  fighters: [],
  particles: [],
  projectiles: [],
  round: 1,
  roundTimer: 60,
  roundIntro: 0,
  outroTimer: 0,
  announcer: { text: "Shadow Rift Duel", sub: "Press Start Duel or Enter", timer: 0 },
  screenShake: 0,
  flash: 0,
  time: 0,
  lastTimestamp: 0,
  accumulator: 0,
  useManualClock: false,
  weatherPulse: 0,
  lightningCooldown: 2.8,
  pendingRoundResult: null,
};

function warmSpriteAssets() {
  const uniqueSources = [
    ...new Set([
      ...Object.values(stageManifest),
      ...Object.values(spriteManifest).flatMap((entry) => Object.values(entry).map((animation) => animation.src)),
    ]),
  ];
  const loads = uniqueSources.map(
    (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedImages.set(src, img);
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = src;
      }),
  );
  return Promise.all(loads).then((results) => {
    state.assetsReady = results.every(Boolean);
  });
}

function getLoadedImage(src) {
  return loadedImages.get(src) || null;
}

function createFighter(config) {
  return {
    ...config,
    x: config.startX,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    health: config.maxHealth,
    meter: 32,
    roundsWon: 0,
    facing: config.startFacing,
    onGround: true,
    attack: null,
    hurtTimer: 0,
    blockGlow: 0,
    comboCount: 0,
    comboTimer: 0,
    pose: "idle",
    poseTime: 0,
    control: {
      left: false,
      right: false,
      jump: false,
      block: false,
      light: false,
      heavy: false,
      special: false,
    },
    aiMemory: {
      decisionCooldown: 0,
      strafe: 0,
      jumpCooldown: 0,
    },
  };
}

function resetFighterForRound(fighter, x, facing) {
  fighter.x = x;
  fighter.y = FLOOR_Y;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.health = fighter.maxHealth;
  fighter.meter = clamp(fighter.meter + 10, 20, 60);
  fighter.facing = facing;
  fighter.onGround = true;
  fighter.attack = null;
  fighter.hurtTimer = 0;
  fighter.blockGlow = 0;
  fighter.comboCount = 0;
  fighter.comboTimer = 0;
  fighter.pose = "idle";
  fighter.poseTime = 0;
}

function setPose(fighter, pose, forceRestart = false) {
  const mappedPose = fighter.sprites[pose] ? pose : "idle";
  if (!forceRestart && fighter.pose === mappedPose) {
    return;
  }
  fighter.pose = mappedPose;
  fighter.poseTime = 0;
}

function faceOpponent(fighter, enemy) {
  if (enemy.x !== fighter.x) {
    fighter.facing = enemy.x > fighter.x ? 1 : -1;
  }
}

function buildRoster() {
  return [
    createFighter({
      id: "nova",
      name: "Nova Hex",
      color: "#7ee7ff",
      accent: "#cbfff5",
      aura: "#76efff",
      startX: 338,
      startFacing: 1,
      speed: 314,
      jumpVelocity: 860,
      maxHealth: 100,
      renderWidth: 348,
      renderHeight: 228,
      bodyWidth: 84,
      bodyHeight: 182,
      sprites: spriteManifest.nova,
      tint: "rgba(116, 239, 255, 0.22)",
      landingGlow: "rgba(91, 231, 255, 0.34)",
    }),
    createFighter({
      id: "riot",
      name: "Riot Voss",
      color: "#ffb16a",
      accent: "#ffe4c4",
      aura: "#ff9357",
      startX: WIDTH - 338,
      startFacing: -1,
      speed: 270,
      jumpVelocity: 760,
      maxHealth: 100,
      renderWidth: 344,
      renderHeight: 226,
      bodyWidth: 86,
      bodyHeight: 180,
      sprites: spriteManifest.riot,
      tint: "rgba(255, 147, 87, 0.2)",
      landingGlow: "rgba(255, 140, 90, 0.34)",
      canJump: false,
    }),
  ];
}

function initAttractMode() {
  state.mode = "menu";
  state.paused = false;
  state.fighters = buildRoster();
  resetFighterForRound(state.fighters[0], 314, 1);
  resetFighterForRound(state.fighters[1], WIDTH - 324, -1);
  setPose(state.fighters[0], "walk", true);
  setPose(state.fighters[1], "idle", true);
}

function initMatch() {
  state.round = 1;
  state.projectiles.length = 0;
  state.particles.length = 0;
  state.pendingRoundResult = null;
  state.fighters = buildRoster();
  resetFighterForRound(state.fighters[0], 338, 1);
  resetFighterForRound(state.fighters[1], WIDTH - 338, -1);
  beginRound();
}

function beginRound() {
  state.mode = "intro";
  state.paused = false;
  state.roundTimer = 60;
  state.roundIntro = 1.35;
  state.outroTimer = 0;
  state.projectiles.length = 0;
  state.particles.length = 0;
  state.pendingRoundResult = null;
  resetFighterForRound(state.fighters[0], 338, 1);
  resetFighterForRound(state.fighters[1], WIDTH - 338, -1);
  state.announcer = {
    text: `Round ${state.round}`,
    sub: "Blacktop district lockdown",
    timer: 1.1,
  };
  audio.playRoundStart();
}

function startGame() {
  audio.unlock();
  initMatch();
  document.activeElement?.blur?.();
  canvas.focus();
}

function queueRoundResult(winner, reason) {
  if (!state.pendingRoundResult) {
    state.pendingRoundResult = { winner, reason };
  }
}

function resolveRoundResult() {
  const result = state.pendingRoundResult;
  if (!result) {
    return;
  }
  state.pendingRoundResult = null;
  state.mode = "outro";
  state.outroTimer = 3.2;
  result.winner.roundsWon += 1;
  state.announcer = {
    text: result.reason === "time" ? "Time Over" : "K.O.",
    sub: `${result.winner.name} bere kolo`,
    timer: 2.6,
  };
  audio.playWin();
}

function togglePause() {
  if (state.mode !== "menu" && state.mode !== "match-over") {
    state.paused = !state.paused;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function getPlayerControl() {
  const held = keyState.held;
  const pressed = keyState.pressed;
  return {
    left: held.has("KeyA") || held.has("ArrowLeft"),
    right: held.has("KeyD") || held.has("ArrowRight"),
    jump: pressed.has("KeyW") || pressed.has("ArrowUp"),
    block: held.has("KeyS") || held.has("ArrowDown"),
    light: pressed.has("KeyJ") || pressed.has("Space"),
    heavy: pressed.has("KeyK") || pressed.has("KeyQ"),
    special: pressed.has("KeyL") || pressed.has("KeyB"),
  };
}

function computeAIControl(fighter, enemy) {
  const ai = fighter.aiMemory;
  ai.decisionCooldown = Math.max(0, ai.decisionCooldown - FIXED_STEP);
  ai.jumpCooldown = Math.max(0, ai.jumpCooldown - FIXED_STEP);
  ai.strafe = Math.max(0, ai.strafe - FIXED_STEP);

  const dx = enemy.x - fighter.x;
  const distance = Math.abs(dx);
  const movingToward = dx > 0;
  const incomingProjectile = state.projectiles.some(
    (projectile) => projectile.owner !== fighter && Math.abs(projectile.x - fighter.x) < 150,
  );

  const control = {
    left: false,
    right: false,
    jump: false,
    block: false,
    light: false,
    heavy: false,
    special: false,
  };

  if (distance > 120 || ai.strafe > 0) {
    control.left = !movingToward;
    control.right = movingToward;
  }

  if (incomingProjectile || enemy.attack?.type === "heavy") {
    control.block = distance < 170;
  }

  if (distance < 128 && ai.decisionCooldown === 0 && !fighter.attack) {
    const roll = Math.random();
    if (roll < 0.48) {
      control.light = true;
      ai.decisionCooldown = rand(0.3, 0.5);
    } else if (roll < 0.82) {
      control.heavy = true;
      ai.decisionCooldown = rand(0.48, 0.75);
    } else if (fighter.meter >= ATTACK_LIBRARY.special.meterCost && distance < 280) {
      control.special = true;
      ai.decisionCooldown = rand(0.7, 1.1);
    } else {
      control.block = true;
      ai.decisionCooldown = rand(0.12, 0.25);
    }
  } else if (
    fighter.meter >= ATTACK_LIBRARY.special.meterCost &&
    distance > 180 &&
    distance < 340 &&
    ai.decisionCooldown === 0 &&
    !fighter.attack
  ) {
    control.special = true;
    ai.decisionCooldown = rand(0.8, 1.2);
  }

  if (fighter.canJump !== false && distance > 220 && ai.jumpCooldown === 0 && Math.random() < 0.008) {
    control.jump = true;
    ai.jumpCooldown = rand(1.2, 2.4);
  }

  return control;
}

function intersectBodies(a, b, padding = 0) {
  const leftA = a.x - a.bodyWidth / 2 - padding;
  const rightA = a.x + a.bodyWidth / 2 + padding;
  const topA = a.y - a.bodyHeight;
  const bottomA = a.y;

  const leftB = b.x - b.bodyWidth / 2;
  const rightB = b.x + b.bodyWidth / 2;
  const topB = b.y - b.bodyHeight;
  const bottomB = b.y;

  return leftA <= rightB && rightA >= leftB && topA <= bottomB && bottomA >= topB;
}

function pushFightersApart(left, right) {
  // Let aerial movement cross over so fighters can swap sides and re-face naturally.
  if (!left.onGround || !right.onGround) {
    return;
  }
  const overlap = left.bodyWidth / 2 + right.bodyWidth / 2 - Math.abs(left.x - right.x);
  if (overlap > 0) {
    const push = overlap / 2 + 1;
    if (left.x < right.x) {
      left.x -= push;
      right.x += push;
    } else {
      left.x += push;
      right.x -= push;
    }
  }
}

function gainMeter(fighter, amount) {
  fighter.meter = clamp(fighter.meter + amount, 0, 100);
}

function emitImpact(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-220, 220),
      vy: rand(-260, 80),
      life: rand(0.16, 0.4),
      size: rand(2, 7),
      color,
      glow: Math.random() > 0.55,
    });
  }
}

function receiveHit(attacker, defender, attackSpec, kind) {
  const guarding = defender.control.block && defender.onGround && defender.facing === -attacker.facing;
  const damageMultiplier = attacker.comboTimer > 0 ? clamp(1 + attacker.comboCount * 0.08, 1, 1.36) : 1;
  const damage = Math.round(attackSpec.damage * damageMultiplier * (guarding ? 0.28 : 1));
  const knockback = attackSpec.knockback * (guarding ? 0.32 : 1);
  const launch = attackSpec.launch * (guarding ? 0.18 : 1);

  defender.health = clamp(defender.health - damage, 0, defender.maxHealth);
  defender.vx = attacker.facing * knockback;
  defender.vy = -launch;
  defender.hurtTimer = guarding ? 0.11 : 0.22;
  defender.blockGlow = guarding ? 0.22 : 0;

  attacker.comboCount = attacker.comboTimer > 0 ? attacker.comboCount + 1 : 1;
  attacker.comboTimer = 1.15;
  gainMeter(attacker, guarding ? 5 : attackSpec.meterGain);
  gainMeter(defender, guarding ? 3 : 6);

  state.screenShake = Math.max(state.screenShake, kind === "heavy" ? 16 : 9);
  state.flash = Math.max(state.flash, guarding ? 0.08 : 0.12);
  audio.playHit(guarding ? "block" : kind);
  emitImpact(defender.x + attacker.facing * 24, defender.y - defender.bodyHeight * 0.56, attackSpec.color, attackSpec.particleCount);

  if (defender.health <= 0) {
    queueRoundResult(attacker, "ko");
  }
}

function spawnProjectile(fighter) {
  state.projectiles.push({
    owner: fighter,
    x: fighter.x + fighter.facing * 70,
    y: fighter.y - fighter.bodyHeight * 0.58,
    vx: fighter.facing * ATTACK_LIBRARY.special.projectileSpeed,
    radius: 20,
    life: 1.5,
    color: fighter.aura,
    damage: ATTACK_LIBRARY.special.damage,
  });
  audio.playSpecial();
}

function tryStartAttack(fighter, type) {
  if (fighter.attack || fighter.hurtTimer > 0 || state.mode !== "fight") {
    return;
  }
  const spec = ATTACK_LIBRARY[type];
  if (!spec) {
    return;
  }
  if (type === "special" && fighter.meter < spec.meterCost) {
    return;
  }
  if (type === "special") {
    fighter.meter -= spec.meterCost;
  }
  fighter.attack = {
    type,
    timer: 0,
    hitLanded: false,
    projectileSpawned: false,
    spec,
  };
  setPose(fighter, type, true);
}

function updateAttack(fighter, enemy) {
  if (!fighter.attack) {
    return;
  }
  const attack = fighter.attack;
  attack.timer += FIXED_STEP;
  const total = attack.spec.startup + attack.spec.active + attack.spec.recovery;

  if (attack.type === "special" && !attack.projectileSpawned && attack.timer >= attack.spec.startup) {
    attack.projectileSpawned = true;
    spawnProjectile(fighter);
  }

  if (
    attack.type !== "special" &&
    !attack.hitLanded &&
    attack.timer >= attack.spec.startup &&
    attack.timer <= attack.spec.startup + attack.spec.active &&
    intersectBodies(
      {
        x: fighter.x + fighter.facing * attack.spec.range * 0.55,
        y: fighter.y,
        bodyWidth: attack.spec.range,
        bodyHeight: fighter.bodyHeight * 0.84,
      },
      enemy,
      8,
    )
  ) {
    attack.hitLanded = true;
    receiveHit(fighter, enemy, attack.spec, attack.type === "heavy" ? "heavy" : "light");
  }

  if (attack.timer >= total) {
    fighter.attack = null;
    setPose(fighter, "idle");
  }
}

function updateProjectile(projectile, index) {
  projectile.life -= FIXED_STEP;
  projectile.x += projectile.vx * FIXED_STEP;
  if (projectile.life <= 0 || projectile.x < -40 || projectile.x > WIDTH + 40) {
    state.projectiles.splice(index, 1);
    return;
  }

  const defender = projectile.owner === state.fighters[0] ? state.fighters[1] : state.fighters[0];
  const hitbox = {
    x: projectile.x,
    y: projectile.y + projectile.radius,
    bodyWidth: projectile.radius * 2,
    bodyHeight: projectile.radius * 2,
  };
  if (intersectBodies(hitbox, defender)) {
    receiveHit(projectile.owner, defender, ATTACK_LIBRARY.special, "heavy");
    state.projectiles.splice(index, 1);
  }
}

function applyControlToFighter(fighter, enemy) {
  fighter.poseTime += FIXED_STEP;

  if (fighter.health <= 0) {
    fighter.vx *= 0.88;
    setPose(fighter, "ko");
    return;
  }

  fighter.comboTimer = Math.max(0, fighter.comboTimer - FIXED_STEP);
  if (fighter.comboTimer === 0) {
    fighter.comboCount = 0;
  }
  fighter.hurtTimer = Math.max(0, fighter.hurtTimer - FIXED_STEP);
  fighter.blockGlow = Math.max(0, fighter.blockGlow - FIXED_STEP);

  faceOpponent(fighter, enemy);

  if (fighter.attack) {
    updateAttack(fighter, enemy);
  }

  const control = fighter.control;
  const direction = (control.left ? -1 : 0) + (control.right ? 1 : 0);
  const blocked = fighter.hurtTimer > 0 || fighter.attack;

  if (!blocked) {
    if (fighter.canJump !== false && control.jump && fighter.onGround) {
      fighter.vy = -fighter.jumpVelocity;
      fighter.onGround = false;
      setPose(fighter, "jump", true);
    }

    if (control.light) {
      tryStartAttack(fighter, "light");
    } else if (control.heavy) {
      tryStartAttack(fighter, "heavy");
    } else if (control.special) {
      tryStartAttack(fighter, "special");
    }
  }

  const targetSpeed = blocked ? 0 : direction * fighter.speed * (control.block ? 0.35 : 1);
  fighter.vx = lerp(fighter.vx, targetSpeed, fighter.onGround ? 0.2 : 0.08);
  fighter.vy += 1800 * FIXED_STEP;
  fighter.x += fighter.vx * FIXED_STEP;
  fighter.y += fighter.vy * FIXED_STEP;

  if (fighter.y >= FLOOR_Y) {
    fighter.y = FLOOR_Y;
    fighter.vy = 0;
    fighter.onGround = true;
  } else {
    fighter.onGround = false;
  }

  fighter.x = clamp(fighter.x, STAGE_LEFT, STAGE_RIGHT);
  faceOpponent(fighter, enemy);

  if (fighter.health <= 0) {
    setPose(fighter, "ko");
  } else if (fighter.hurtTimer > 0) {
    setPose(fighter, "hurt");
  } else if (fighter.attack) {
    setPose(fighter, fighter.attack.type);
  } else if (!fighter.onGround) {
    setPose(fighter, "jump");
  } else if (control.block) {
    setPose(fighter, "block");
  } else if (Math.abs(fighter.vx) > 24) {
    setPose(fighter, "walk");
  } else {
    setPose(fighter, "idle");
  }
}

function updateParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    particle.life -= FIXED_STEP;
    particle.x += particle.vx * FIXED_STEP;
    particle.y += particle.vy * FIXED_STEP;
    particle.vx *= 0.97;
    particle.vy += 880 * FIXED_STEP;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function updateWorld() {
  if (state.mode === "menu" || state.paused) {
    state.time += FIXED_STEP;
    state.weatherPulse += FIXED_STEP * 0.45;
    if (state.mode === "menu" && state.fighters.length === 2) {
      const [nova, riot] = state.fighters;
      const cycle = state.time % 6.4;
      nova.attack = null;
      riot.attack = null;
      nova.vx = 0;
      nova.vy = 0;
      riot.vx = 0;
      riot.vy = 0;
      nova.facing = 1;
      riot.facing = -1;
      nova.x = 314 + Math.sin(state.time * 1.5) * 34;
      riot.x = WIDTH - 324 + Math.sin(state.time * 1.15 + 1.9) * 18;
      nova.y = FLOOR_Y;
      riot.y = FLOOR_Y;
      nova.onGround = true;
      riot.onGround = true;

      if (cycle < 1.7) {
        setPose(nova, "walk");
      } else if (cycle < 2.55) {
        setPose(nova, "light");
      } else if (cycle < 3.45) {
        setPose(nova, "heavy");
      } else if (cycle < 4.2) {
        nova.y = FLOOR_Y - 42;
        nova.onGround = false;
        setPose(nova, "jump");
      } else {
        setPose(nova, "idle");
      }

      if (cycle < 2.1) {
        setPose(riot, "idle");
      } else if (cycle < 3.35) {
        setPose(riot, "walk");
      } else if (cycle < 4.25) {
        setPose(riot, "light");
      } else if (cycle < 4.95) {
        setPose(riot, "hurt");
      } else {
        setPose(riot, "idle");
      }
    }
    for (const fighter of state.fighters) {
      fighter.poseTime += FIXED_STEP;
    }
    return;
  }

  state.time += FIXED_STEP;
  state.screenShake = Math.max(0, state.screenShake - 0.9);
  state.flash = Math.max(0, state.flash - FIXED_STEP * 2.2);
  state.lightningCooldown -= FIXED_STEP;
  state.weatherPulse += FIXED_STEP;

  if (state.lightningCooldown <= 0) {
    state.flash = Math.max(state.flash, rand(0.12, 0.22));
    state.lightningCooldown = rand(4.2, 8.2);
  }

  if (state.announcer.timer > 0) {
    state.announcer.timer -= FIXED_STEP;
  }

  if (state.mode === "intro") {
    state.roundIntro -= FIXED_STEP;
    if (state.roundIntro < 0.55 && state.announcer.sub !== "Fight!") {
      state.announcer.sub = "Fight!";
    }
    if (state.roundIntro <= 0) {
      state.mode = "fight";
      state.announcer = { text: "Fight!", sub: "Take the district", timer: 0.8 };
    }
    return;
  } else if (state.mode === "fight") {
    state.roundTimer = Math.max(0, state.roundTimer - FIXED_STEP);
    if (state.roundTimer === 0) {
      const [a, b] = state.fighters;
      const winner = a.health === b.health ? (a.meter >= b.meter ? a : b) : a.health > b.health ? a : b;
      queueRoundResult(winner, "time");
    }
  } else if (state.mode === "outro") {
    state.outroTimer -= FIXED_STEP;
    if (state.outroTimer <= 0) {
      const champion = state.fighters.find((fighter) => fighter.roundsWon >= MAX_ROUNDS_TO_WIN);
      if (champion) {
        state.mode = "match-over";
        state.announcer = {
          text: `${champion.name} wins`,
          sub: "Restart for another run",
          timer: 999,
        };
      } else {
        state.round += 1;
        beginRound();
      }
    }
    updateParticles();
    return;
  }

  const [player, enemy] = state.fighters;
  player.control = getPlayerControl();
  enemy.control = state.aiEnabled ? computeAIControl(enemy, player) : {
    left: false,
    right: false,
    jump: false,
    block: false,
    light: false,
    heavy: false,
    special: false,
  };

  applyControlToFighter(player, enemy);
  applyControlToFighter(enemy, player);
  pushFightersApart(player, enemy);

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    updateProjectile(state.projectiles[i], i);
  }
  updateParticles();
  resolveRoundResult();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#04070d");
  gradient.addColorStop(0.34, "#0a1120");
  gradient.addColorStop(0.64, "#180c1d");
  gradient.addColorStop(1, "#2a0b12");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const leftGlow = ctx.createRadialGradient(150, 112, 20, 150, 112, 300);
  leftGlow.addColorStop(0, "rgba(83, 232, 255, 0.24)");
  leftGlow.addColorStop(1, "rgba(83, 232, 255, 0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, 480, 380);

  const rightGlow = ctx.createRadialGradient(WIDTH - 164, 136, 20, WIDTH - 164, 136, 310);
  rightGlow.addColorStop(0, "rgba(255, 118, 71, 0.3)");
  rightGlow.addColorStop(1, "rgba(255, 118, 71, 0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(WIDTH - 540, 0, 540, 390);

  const coreGlow = ctx.createRadialGradient(WIDTH * 0.58, HORIZON_Y - 98, 30, WIDTH * 0.58, HORIZON_Y - 98, 320);
  coreGlow.addColorStop(0, "rgba(255, 236, 196, 0.13)");
  coreGlow.addColorStop(1, "rgba(255, 236, 196, 0)");
  ctx.fillStyle = coreGlow;
  ctx.fillRect(WIDTH * 0.28, 0, WIDTH * 0.56, HORIZON_Y + 120);

  const beams = [
    { x: 84, spread: 280, depth: 182, color: "rgba(92, 227, 255, 0.07)" },
    { x: WIDTH - 90, spread: -292, depth: 188, color: "rgba(255, 138, 82, 0.08)" },
    { x: WIDTH * 0.56, spread: 118, depth: 168, color: "rgba(255, 235, 196, 0.05)" },
  ];
  for (const beam of beams) {
    ctx.fillStyle = beam.color;
    ctx.beginPath();
    ctx.moveTo(beam.x, 0);
    ctx.lineTo(beam.x + beam.spread, HORIZON_Y + beam.depth);
    ctx.lineTo(beam.x - beam.spread * 0.18, HORIZON_Y + beam.depth);
    ctx.closePath();
    ctx.fill();
  }

  const skyline = getLoadedImage(stageManifest.skyline);
  if (skyline) {
    for (let i = -1; i < 8; i++) {
      const x = i * 198 - ((state.time * 22) % 198);
      ctx.globalAlpha = 0.62;
      ctx.drawImage(skyline, x, 142, 244, 202);
    }
    for (let i = -1; i < 6; i++) {
      const x = i * 256 - ((state.time * 12) % 256);
      ctx.globalAlpha = 0.2;
      ctx.drawImage(skyline, x, 186, 310, 248);
    }
    ctx.globalAlpha = 1;
  }

  const banner = getLoadedImage(stageManifest.banner);
  if (banner) {
    const bannerXs = [104, 318, 542, 768, 998];
    for (let i = 0; i < bannerXs.length; i++) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(banner, bannerXs[i], 142 + Math.sin(state.time * 1.18 + i) * 3, 126, 34);
    }
    ctx.globalAlpha = 1;
  }

  const billboards = [
    { x: 198, y: 188, w: 124, h: 36, glow: "#73e8ff", label: "VOID RAIL" },
    { x: 560, y: 166, w: 142, h: 40, glow: "#ff9357", label: "PIT 09" },
    { x: WIDTH - 234, y: 194, w: 126, h: 36, glow: "#73e8ff", label: "SECTOR 7" },
  ];
  ctx.textAlign = "center";
  for (const panel of billboards) {
    ctx.fillStyle = "rgba(9, 12, 18, 0.82)";
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = `${panel.glow}55`;
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = panel.glow;
    ctx.font = "18px Haettenschweiler, Impact, sans-serif";
    ctx.fillText(panel.label, panel.x + panel.w / 2, panel.y + 24);
  }
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(255, 168, 104, 0.12)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 92 + i * 20;
    ctx.beginPath();
    ctx.moveTo(-40 + i * 312, y);
    ctx.lineTo(180 + i * 312, y + 10);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(121, 229, 255, 0.13)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 48; i++) {
    const x = (i * 31 + state.time * 140) % (WIDTH + 120) - 60;
    const y = (i * 47 + state.time * 320) % HEIGHT;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 12, y + 30);
    ctx.stroke();
  }
}

function drawTempleSilhouette() {
  ctx.save();
  ctx.fillStyle = "rgba(6, 5, 10, 0.56)";
  ctx.fillRect(0, HORIZON_Y - 12, WIDTH, FLOOR_Y - HORIZON_Y + 16);

  ctx.fillStyle = "rgba(10, 12, 18, 0.84)";
  ctx.fillRect(0, HORIZON_Y + 42, WIDTH, 20);
  ctx.fillStyle = "rgba(255, 189, 122, 0.18)";
  for (let x = 48; x < WIDTH; x += 78) {
    ctx.fillRect(x, HORIZON_Y + 47, 24, 4);
  }

  ctx.strokeStyle = "rgba(255, 124, 78, 0.13)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 7; i++) {
    const x = 84 + i * 188;
    ctx.beginPath();
    ctx.moveTo(x, HORIZON_Y + 10);
    ctx.lineTo(x - 12, FLOOR_Y - 18);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(118, 232, 255, 0.08)";
  ctx.lineWidth = 1.2;
  for (let x = -120; x < WIDTH + 120; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, HORIZON_Y + 62);
    ctx.lineTo(x + 28, FLOOR_Y - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 28, HORIZON_Y + 62);
    ctx.lineTo(x, FLOOR_Y - 18);
    ctx.stroke();
  }

  const signX = WIDTH * 0.62 - 214;
  const signY = HORIZON_Y - 112;
  const signW = 428;
  const signH = 86;
  ctx.beginPath();
  ctx.moveTo(signX + 18, signY);
  ctx.lineTo(signX + signW - 54, signY);
  ctx.lineTo(signX + signW, signY + 26);
  ctx.lineTo(signX + signW - 22, signY + signH);
  ctx.lineTo(signX + 54, signY + signH);
  ctx.lineTo(signX, signY + signH - 24);
  ctx.closePath();
  ctx.fillStyle = "rgba(11, 8, 17, 0.8)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 184, 118, 0.32)";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#7ee7ff";
  ctx.font = "16px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("BLACKTOP VII", signX + signW / 2, signY + 24);
  ctx.fillStyle = "#fff0e2";
  ctx.font = "38px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("FIGHT DOCK", signX + signW / 2, signY + 60);

  const boothX = 122;
  const boothY = HORIZON_Y - 18;
  const boothW = 196;
  const boothH = 62;
  ctx.beginPath();
  ctx.moveTo(boothX, boothY + 12);
  ctx.lineTo(boothX + boothW - 24, boothY + 12);
  ctx.lineTo(boothX + boothW, boothY + boothH);
  ctx.lineTo(boothX + 18, boothY + boothH);
  ctx.closePath();
  ctx.fillStyle = "rgba(10, 11, 17, 0.84)";
  ctx.fill();
  ctx.strokeStyle = "rgba(115, 232, 255, 0.24)";
  ctx.stroke();
  ctx.fillStyle = "#ffbb73";
  ctx.font = "16px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("LIVE PIT", boothX + 18, boothY + 30);
  ctx.fillStyle = "#f8eee0";
  ctx.font = "22px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("Sector 7", boothX + 18, boothY + 50);
  ctx.restore();
}

function drawFloor() {
  const floorGradient = ctx.createLinearGradient(0, FLOOR_Y - 42, 0, HEIGHT);
  floorGradient.addColorStop(0, "#2b1119");
  floorGradient.addColorStop(1, "#040407");
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, FLOOR_Y - 30, WIDTH, HEIGHT - FLOOR_Y + 30);

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, FLOOR_Y - 18, WIDTH, 20);

  ctx.strokeStyle = "rgba(255, 177, 105, 0.16)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(STAGE_LEFT - 60, FLOOR_Y);
  ctx.lineTo(STAGE_RIGHT + 60, FLOOR_Y);
  ctx.stroke();

  for (let x = STAGE_LEFT - 10; x < STAGE_RIGHT; x += 46) {
    ctx.fillStyle = (Math.floor((x - STAGE_LEFT) / 46) % 2 === 0)
      ? "rgba(255, 176, 103, 0.26)"
      : "rgba(116, 239, 255, 0.14)";
    ctx.fillRect(x, FLOOR_Y - 18, 28, 6);
  }

  ctx.strokeStyle = "rgba(121, 233, 255, 0.09)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.5, FLOOR_Y - 16);
    ctx.lineTo(48 + i * 170, HEIGHT + 20);
    ctx.stroke();
  }

  const zoneGlow = ctx.createRadialGradient(WIDTH * 0.5, FLOOR_Y + 18, 12, WIDTH * 0.5, FLOOR_Y + 18, 280);
  zoneGlow.addColorStop(0, "rgba(255, 177, 105, 0.16)");
  zoneGlow.addColorStop(0.45, "rgba(121, 233, 255, 0.08)");
  zoneGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = zoneGlow;
  ctx.beginPath();
  ctx.ellipse(WIDTH * 0.5, FLOOR_Y + 22, 320, 68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(121, 233, 255, 0.12)";
  for (let i = 0; i < 6; i++) {
    const x = 170 + i * 184;
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 14, 34, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(${60 + i * 10}, ${165 + i * 6}, ${255 - i * 6}, ${0.04 + i * 0.01})`;
    ctx.beginPath();
    ctx.ellipse(110 + i * 152, FLOOR_Y + 28 + Math.sin(state.weatherPulse * 0.7 + i) * 6, 92, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const car = getLoadedImage(stageManifest.car);
  if (car) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(car, 6, FLOOR_Y - 144, 408, 138);
    ctx.globalAlpha = 1;
  }

  const barrel = getLoadedImage(stageManifest.barrel);
  if (barrel) {
    ctx.drawImage(barrel, WIDTH - 182, FLOOR_Y - 90, 92, 92);
  }

  const hydrant = getLoadedImage(stageManifest.hydrant);
  if (hydrant) {
    ctx.drawImage(hydrant, WIDTH - 318, FLOOR_Y - 68, 58, 68);
  }
}

function drawStreetForeground() {
  const foreground = getLoadedImage(stageManifest.foreground);
  if (foreground) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.drawImage(foreground, -82, FLOOR_Y - 236, 372, 288);
    ctx.drawImage(foreground, WIDTH - 290, FLOOR_Y - 236, 372, 288);
    ctx.restore();
  }
}

function traceBarShape(x, y, width, height, cut, alignRight) {
  ctx.beginPath();
  if (alignRight) {
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width - cut, y + height);
    ctx.lineTo(x, y + height);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + width - cut, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + cut, y + height);
  }
  ctx.closePath();
}

function drawHealthBar(x, y, width, height, ratio, color, name, roundsWon, alignRight) {
  const cut = 24;
  ctx.save();
  traceBarShape(x, y, width, height, cut, alignRight);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 240, 214, 0.22)";
  ctx.stroke();

  const fillWidth = width * clamp(ratio, 0, 1);
  if (fillWidth > 6) {
    const fillX = alignRight ? x + width - fillWidth : x;
    const fillCut = Math.min(cut, Math.max(10, fillWidth * 0.38));
    traceBarShape(fillX, y, fillWidth, height, fillCut, alignRight);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = alignRight ? "right" : "left";
  ctx.font = "20px Haettenschweiler, Impact, sans-serif";
  ctx.fillStyle = "#fff2e3";
  ctx.fillText(name, alignRight ? x + width : x, y - 8);
  for (let i = 0; i < MAX_ROUNDS_TO_WIN; i++) {
    const px = alignRight ? x + width - 18 - i * 22 : x + 18 + i * 22;
    ctx.save();
    ctx.translate(px, y + height + 15);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < roundsWon ? color : "rgba(255,255,255,0.11)";
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.restore();
}

function drawMeterBar(x, y, width, ratio, color, alignRight) {
  const cut = 14;
  ctx.save();
  traceBarShape(x, y, width, 10, cut, alignRight);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  const fillWidth = width * clamp(ratio, 0, 1);
  if (fillWidth > 4) {
    const fillX = alignRight ? x + width - fillWidth : x;
    const fillCut = Math.min(cut, Math.max(8, fillWidth * 0.3));
    traceBarShape(fillX, y, fillWidth, 10, fillCut, alignRight);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

function drawHUD() {
  if (state.fighters.length < 2 || state.mode === "menu") {
    return;
  }
  const [left, right] = state.fighters;
  ctx.save();
  drawHealthBar(54, 34, 460, 20, left.health / left.maxHealth, left.color, left.name, left.roundsWon, false);
  drawHealthBar(WIDTH - 54 - 460, 34, 460, 20, right.health / right.maxHealth, right.color, right.name, right.roundsWon, true);
  drawMeterBar(78, 64, 240, left.meter / 100, left.aura, false);
  drawMeterBar(WIDTH - 78 - 240, 64, 240, right.meter / 100, right.aura, true);

  const timerX = WIDTH / 2 - 102;
  const timerY = 18;
  const timerW = 204;
  const timerH = 82;
  ctx.beginPath();
  ctx.moveTo(timerX + 20, timerY);
  ctx.lineTo(timerX + timerW - 20, timerY);
  ctx.lineTo(timerX + timerW, timerY + 18);
  ctx.lineTo(timerX + timerW - 18, timerY + timerH);
  ctx.lineTo(timerX + 18, timerY + timerH);
  ctx.lineTo(timerX, timerY + 18);
  ctx.closePath();
  ctx.fillStyle = "rgba(8, 8, 12, 0.8)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 218, 181, 0.18)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 202, 134, 0.76)";
  ctx.font = "14px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Round ${state.round}`, WIDTH / 2, 38);
  ctx.fillStyle = "#f6eadf";
  ctx.font = "42px Haettenschweiler, Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.ceil(state.roundTimer)), WIDTH / 2, 76);
  ctx.font = "15px Trebuchet MS";
  ctx.fillStyle = "rgba(246, 234, 223, 0.76)";
  ctx.fillText("District timer", WIDTH / 2, 92);
  ctx.restore();
}

function drawFighter(fighter) {
  const animation = fighter.sprites[fighter.pose] || fighter.sprites.idle;
  const image = getLoadedImage(animation.src);
  const bob = fighter.onGround ? Math.sin(state.time * 7 + fighter.x * 0.02) * 1.8 : -4;
  const shadowWidth = fighter.bodyWidth * (fighter.onGround ? 1.15 : 0.8);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(fighter.x, FLOOR_Y + 10, shadowWidth, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing, 1);

  const aura = ctx.createRadialGradient(0, -fighter.renderHeight * 0.54, 16, 0, -fighter.renderHeight * 0.5, fighter.renderWidth * 0.7);
  aura.addColorStop(0, fighter.tint);
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, -fighter.renderHeight * 0.46, fighter.renderWidth * 0.58, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.blockGlow > 0) {
    ctx.strokeStyle = `rgba(255, 236, 190, ${fighter.blockGlow * 3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -fighter.renderHeight * 0.48, fighter.renderWidth * 0.32, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
  }

  if (image) {
    const frameIndex = animation.loop
      ? Math.floor(fighter.poseTime * animation.fps) % animation.frames
      : Math.min(animation.frames - 1, Math.floor(fighter.poseTime * animation.fps));
    const sx = frameIndex * animation.frameWidth;
    ctx.shadowColor = fighter.aura;
    ctx.shadowBlur = 14;
    ctx.drawImage(
      image,
      sx,
      0,
      animation.frameWidth,
      animation.frameHeight,
      -fighter.renderWidth * 0.5,
      -fighter.renderHeight + 6,
      fighter.renderWidth,
      fighter.renderHeight,
    );
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = fighter.color;
    ctx.fillRect(-fighter.bodyWidth / 2, -fighter.bodyHeight, fighter.bodyWidth, fighter.bodyHeight);
  }

  ctx.restore();

  if (fighter.comboCount >= 2 && fighter.comboTimer > 0) {
    ctx.save();
    ctx.font = "22px Impact, sans-serif";
    ctx.fillStyle = fighter.color;
    const isLeftSide = fighter === state.fighters[0];
    ctx.textAlign = isLeftSide ? "left" : "right";
    const x = isLeftSide ? 90 : WIDTH - 90;
    ctx.fillText(`${fighter.comboCount} HIT CHAIN`, x, 132);
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    ctx.save();
    const glow = ctx.createRadialGradient(projectile.x, projectile.y, 4, projectile.x, projectile.y, projectile.radius * 2.6);
    glow.addColorStop(0, projectile.color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ee";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1);
    ctx.fillStyle = particle.color;
    if (particle.glow) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = particle.color;
    }
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.restore();
  }
}

function drawMenuOverlay() {
  const pulse = (Math.sin(state.time * 2.8) + 1) * 0.5;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255, 147, 87, ${0.18 + pulse * 0.16})`;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.48, 116);
  ctx.lineTo(WIDTH * 0.57, 422);
  ctx.stroke();

  ctx.strokeStyle = `rgba(115, 232, 255, ${0.16 + pulse * 0.14})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.51, 116);
  ctx.lineTo(WIDTH * 0.6, 422);
  ctx.stroke();

  const infoX = 82;
  const infoY = 74;
  const infoW = 320;
  const infoH = 92;
  ctx.beginPath();
  ctx.moveTo(infoX + 16, infoY);
  ctx.lineTo(infoX + infoW - 56, infoY);
  ctx.lineTo(infoX + infoW, infoY + 22);
  ctx.lineTo(infoX + infoW - 18, infoY + infoH);
  ctx.lineTo(infoX + 14, infoY + infoH);
  ctx.lineTo(infoX, infoY + 18);
  ctx.closePath();
  ctx.fillStyle = "rgba(8, 7, 12, 0.84)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 190, 124, 0.24)";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffb979";
  ctx.font = "16px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("LIVE PIRATE FEED", infoX + 18, infoY + 28);
  ctx.fillStyle = "#fff3e8";
  ctx.font = "38px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("UNDERCITY SIGNAL", infoX + 18, infoY + 64);
  ctx.fillStyle = "rgba(255, 243, 232, 0.74)";
  ctx.font = "18px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.fillText("Street duel broadcast locked to Sector 7.", infoX + 18, infoY + 86);

  const matchX = WIDTH - 388;
  const matchY = 72;
  const matchW = 304;
  const matchH = 248;
  ctx.beginPath();
  ctx.moveTo(matchX + 48, matchY);
  ctx.lineTo(matchX + matchW, matchY);
  ctx.lineTo(matchX + matchW - 22, matchY + matchH);
  ctx.lineTo(matchX, matchY + matchH);
  ctx.lineTo(matchX, matchY + 48);
  ctx.closePath();
  ctx.fillStyle = "rgba(9, 8, 14, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(115, 232, 255, 0.22)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffbb73";
  ctx.font = "15px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("TONIGHT'S MAIN EVENT", matchX + matchW / 2, matchY + 26);
  ctx.fillStyle = "#8ff5ff";
  ctx.font = "40px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("NOVA HEX", matchX + matchW / 2, matchY + 82);
  ctx.fillStyle = "#ff9d63";
  ctx.font = "64px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("VS", matchX + matchW / 2, matchY + 142);
  ctx.fillStyle = "#ffd4b0";
  ctx.font = "40px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("RIOT VOSS", matchX + matchW / 2, matchY + 198);
  ctx.fillStyle = "rgba(255, 242, 226, 0.84)";
  ctx.font = "18px Bahnschrift, Trebuchet MS, sans-serif";
  const readiness = state.assetsReady ? "Press Start Duel or Enter." : "Loading fighter reels...";
  ctx.fillText(readiness, matchX + matchW / 2, matchY + 226);

  ctx.fillStyle = "#fff2e4";
  ctx.font = "24px Haettenschweiler, Impact, sans-serif";
  ctx.fillText("SIGNAL LOCKED", WIDTH / 2, HEIGHT - 86);
  ctx.fillStyle = "rgba(255, 185, 120, 0.82)";
  ctx.font = "17px Bahnschrift, Trebuchet MS, sans-serif";
  ctx.fillText("Controls stay captured. Start when ready.", WIDTH / 2, HEIGHT - 60);
  ctx.restore();
}

function drawAnnouncer() {
  if (state.mode === "menu") {
    drawMenuOverlay();
    return;
  }
  if (state.announcer.timer <= 0 && state.mode !== "match-over") {
    return;
  }
  ctx.save();
  const panelW = 432;
  const panelH = 102;
  const panelX = WIDTH / 2 - panelW / 2;
  const panelY = 124;
  ctx.beginPath();
  ctx.moveTo(panelX + 24, panelY);
  ctx.lineTo(panelX + panelW - 24, panelY);
  ctx.lineTo(panelX + panelW, panelY + 20);
  ctx.lineTo(panelX + panelW - 22, panelY + panelH);
  ctx.lineTo(panelX + 22, panelY + panelH);
  ctx.lineTo(panelX, panelY + 20);
  ctx.closePath();
  ctx.fillStyle = "rgba(7, 7, 11, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 216, 178, 0.2)";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "58px Haettenschweiler, Impact, sans-serif";
  ctx.fillStyle = "#fff1e5";
  ctx.fillText(state.announcer.text, WIDTH / 2, panelY + 52);
  ctx.font = "22px Trebuchet MS";
  ctx.fillStyle = "rgba(255, 241, 229, 0.82)";
  ctx.fillText(state.announcer.sub, WIDTH / 2, panelY + 82);
  ctx.restore();
}

function drawPauseOverlay() {
  if (!state.paused) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(4, 2, 3, 0.58)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = "center";
  ctx.font = "74px Impact, sans-serif";
  ctx.fillStyle = "#fff2e6";
  ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);
  ctx.font = "24px Trebuchet MS";
  ctx.fillStyle = "rgba(255, 242, 230, 0.82)";
  ctx.fillText("Stiskni P nebo tlacitko Pause", WIDTH / 2, HEIGHT / 2 + 42);
  ctx.restore();
}

function render() {
  ctx.save();
  if (state.screenShake > 0) {
    ctx.translate(rand(-state.screenShake, state.screenShake), rand(-state.screenShake, state.screenShake));
  }

  drawSky();
  drawTempleSilhouette();
  drawFloor();
  drawProjectiles();
  drawParticles();
  for (const fighter of state.fighters) {
    drawFighter(fighter);
  }
  drawStreetForeground();
  drawHUD();

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.2, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.55})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let y = 0; y < HEIGHT; y += 4) {
    ctx.fillRect(0, y, WIDTH, 1);
  }

  drawAnnouncer();
  drawPauseOverlay();
  ctx.restore();
}

function stepFrame() {
  updateWorld();
  render();
  keyState.pressed.clear();
}

function gameLoop(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }
  const delta = Math.min(0.05, (timestamp - state.lastTimestamp) / 1000);
  state.lastTimestamp = timestamp;

  if (!state.useManualClock) {
    state.accumulator += delta;
    while (state.accumulator >= FIXED_STEP) {
      stepFrame();
      state.accumulator -= FIXED_STEP;
    }
    if (state.accumulator < FIXED_STEP) {
      render();
    }
  } else {
    render();
  }

  requestAnimationFrame(gameLoop);
}

function renderGameToText() {
  const payload = {
    mode: state.mode,
    paused: state.paused,
    round: state.round,
    timer: Number(state.roundTimer.toFixed(2)),
    arena: {
      width: WIDTH,
      height: HEIGHT,
      floorY: FLOOR_Y,
      origin: "top-left",
      axis: "x-right y-down",
    },
    fighters: state.fighters.map((fighter) => ({
      id: fighter.id,
      name: fighter.name,
      x: Number(fighter.x.toFixed(1)),
      y: Number(fighter.y.toFixed(1)),
      vx: Number(fighter.vx.toFixed(1)),
      vy: Number(fighter.vy.toFixed(1)),
      health: fighter.health,
      meter: Number(fighter.meter.toFixed(1)),
      roundsWon: fighter.roundsWon,
      facing: fighter.facing,
      onGround: fighter.onGround,
      blocking: fighter.control.block,
      state: fighter.attack ? fighter.attack.type : fighter.pose,
      comboCount: fighter.comboCount,
    })),
    projectiles: state.projectiles.map((projectile) => ({
      owner: projectile.owner.id,
      x: Number(projectile.x.toFixed(1)),
      y: Number(projectile.y.toFixed(1)),
      vx: Number(projectile.vx.toFixed(1)),
      radius: projectile.radius,
    })),
    announcer: state.announcer.text,
    aiEnabled: state.aiEnabled,
  };
  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  state.useManualClock = true;
  const steps = Math.max(1, Math.round(ms / FIXED_MS));
  for (let i = 0; i < steps; i++) {
    stepFrame();
  }
  return Promise.resolve();
};

document.addEventListener("keydown", (event) => {
  if (GAME_KEYS.has(event.code)) {
    event.preventDefault();
  }
  if (!keyState.held.has(event.code)) {
    keyState.pressed.add(event.code);
  }
  keyState.held.add(event.code);

  if (event.code === "Enter" && (state.mode === "menu" || state.mode === "match-over")) {
    if (state.assetsReady) {
      startGame();
    }
  }
  if (event.code === "KeyP") {
    togglePause();
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
});

document.addEventListener("keyup", (event) => {
  if (GAME_KEYS.has(event.code)) {
    event.preventDefault();
  }
  keyState.held.delete(event.code);
});

startBtn.addEventListener("click", () => {
  if (state.assetsReady) {
    startGame();
  }
});

pauseBtn.addEventListener("click", () => {
  togglePause();
});

restartBtn.addEventListener("click", () => {
  startGame();
});

aiToggle.addEventListener("change", () => {
  state.aiEnabled = aiToggle.checked;
});

warmSpriteAssets().then(() => {
  initAttractMode();
  render();
});

render();
requestAnimationFrame(gameLoop);
