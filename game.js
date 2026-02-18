const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");

const TILE = 48;
const COLS = 20;
const ROWS = 14;
const W = COLS * TILE;
const H = ROWS * TILE;

const DIFFICULTY = {
  story: { monsterRate: 0.6, monsterHp: 18, ammoMult: 1.4, dmgMult: 0.7 },
  standard: { monsterRate: 1, monsterHp: 24, ammoMult: 1, dmgMult: 1 },
  nightmare: { monsterRate: 1.5, monsterHp: 32, ammoMult: 0.75, dmgMult: 1.35 },
};

let difficulty = prompt("Choose difficulty: story / standard / nightmare", "standard")?.toLowerCase() || "standard";
if (!DIFFICULTY[difficulty]) difficulty = "standard";
const diff = DIFFICULTY[difficulty];

function mkFloor() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) grid[y][x] = "#";
    }
  }
  for (let x = 2; x < COLS - 2; x++) grid[6][x] = "#";
  grid[6][9] = ".";
  grid[6][10] = ".";
  for (let y = 2; y < ROWS - 2; y++) {
    grid[y][6] = "#";
    grid[y][13] = "#";
  }
  grid[3][6] = ".";
  grid[10][6] = ".";
  grid[3][13] = ".";
  grid[10][13] = ".";
  return grid;
}

const floors = [mkFloor(), mkFloor()];

const stairA = { x: 1.5 * TILE, y: 1.5 * TILE };
const stairB = { x: (COLS - 1.5) * TILE, y: (ROWS - 1.5) * TILE };

const state = {
  over: false,
  win: false,
  t: 0,
  floor: 0,
  keys: new Set(),
  message: "Find tools, protect openings, and reach the principal's office.",
  player: {
    x: 2.5 * TILE,
    y: 2.5 * TILE,
    r: 10,
    speed: 2.6,
    hp: 100,
    maxHp: 100,
    ammo: Math.floor(24 * diff.ammoMult),
    maxAmmo: Math.floor(42 * diff.ammoMult),
    wood: 8,
    flashLevel: 1,
    gunLevel: 1,
    shootCd: 0,
  },
  bullets: [],
  monsters: [],
  npcs: [
    { name: "Ari", x: 4.5 * TILE, y: 10.2 * TILE, floor: 0, hp: 55, busy: 0 },
    { name: "June", x: 15.3 * TILE, y: 3.2 * TILE, floor: 1, hp: 55, busy: 0 },
  ],
  pickups: [
    { type: "toolkit", x: 16.5 * TILE, y: 10.5 * TILE, floor: 0, taken: false },
    { type: "officeKey", x: 3.5 * TILE, y: 11.5 * TILE, floor: 1, taken: false },
    { type: "ammo", x: 10.5 * TILE, y: 8.5 * TILE, floor: 1, value: 18, taken: false },
    { type: "wood", x: 9.5 * TILE, y: 3.5 * TILE, floor: 0, value: 8, taken: false },
    { type: "flashUpgrade", x: 18.5 * TILE, y: 2.5 * TILE, floor: 0, taken: false },
    { type: "gunUpgrade", x: 1.5 * TILE, y: 12.5 * TILE, floor: 1, taken: false },
  ],
  openings: [],
  principal: null,
};

function makeOpenings() {
  const slots = [
    { x: 0.2 * TILE, y: 4.5 * TILE, side: "left" },
    { x: 0.2 * TILE, y: 9.5 * TILE, side: "left" },
    { x: (COLS - 0.2) * TILE, y: 5.5 * TILE, side: "right" },
    { x: (COLS - 0.2) * TILE, y: 10.5 * TILE, side: "right" },
    { x: 9.5 * TILE, y: 0.2 * TILE, side: "top" },
    { x: 14.5 * TILE, y: (ROWS - 0.2) * TILE, side: "bottom" },
  ];
  for (let f = 0; f < 2; f++) {
    for (const s of slots) {
      state.openings.push({ floor: f, ...s, barricade: 26, maxBarricade: 26, breach: 0, broken: false });
    }
  }
}
makeOpenings();

const keys = {};
addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "1" || e.key === "2") tryFloorSwitch(Number(e.key) - 1);
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "f") commandNpc();
});
addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

const mouse = { x: W / 2, y: H / 2, down: false };
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener("mousedown", () => (mouse.down = true));
canvas.addEventListener("mouseup", () => (mouse.down = false));

function tryFloorSwitch(targetFloor) {
  if (state.floor === targetFloor) return;
  const p = state.player;
  const nearA = dist(p.x, p.y, stairA.x, stairA.y) < 32;
  const nearB = dist(p.x, p.y, stairB.x, stairB.y) < 32;
  if (nearA || nearB) {
    state.floor = targetFloor;
    state.message = `Moved to floor ${targetFloor + 1}.`;
  }
}

function interact() {
  const p = state.player;
  for (const item of state.pickups) {
    if (item.taken || item.floor !== state.floor) continue;
    if (dist(p.x, p.y, item.x, item.y) < 34) {
      item.taken = true;
      if (item.type === "toolkit") {
        p.wood += 12;
        p.ammo = Math.min(p.maxAmmo, p.ammo + 12);
        state.message = "Found a toolkit: +wood, +ammo.";
      } else if (item.type === "officeKey") {
        state.keys.add("office");
        state.message = "You found the principal office key.";
      } else if (item.type === "ammo") {
        p.ammo = Math.min(p.maxAmmo, p.ammo + item.value);
        state.message = `Scavenged ${item.value} darts.`;
      } else if (item.type === "wood") {
        p.wood += item.value;
        state.message = `Scavenged ${item.value} wood boards.`;
      } else if (item.type === "flashUpgrade") {
        p.flashLevel++;
        state.message = "Flashlight upgraded: wider reach.";
      } else if (item.type === "gunUpgrade") {
        p.gunLevel++;
        p.maxAmmo += 12;
        state.message = "Nerf blaster upgraded: stronger stun.";
      }
      return;
    }
  }

  let best = null;
  let bestD = 1e9;
  for (const o of state.openings) {
    if (o.floor !== state.floor) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (best && bestD < 50 && p.wood > 0) {
    const add = Math.min(10, p.wood * 2);
    const spent = Math.ceil(add / 2);
    p.wood -= spent;
    best.barricade = Math.min(best.maxBarricade, best.barricade + add);
    best.broken = false;
    state.message = `Reinforced opening +${add} (${spent} wood).`;
    return;
  }

  if (state.floor === 1 && dist(p.x, p.y, 9.5 * TILE, 1.6 * TILE) < 40) {
    if (!state.keys.has("office")) {
      state.message = "Office is locked. Need the office key.";
      return;
    }
    if (!state.principal) spawnPrincipal();
  }
}

function commandNpc() {
  const p = state.player;
  const candidates = state.npcs.filter((n) => n.floor === state.floor && n.hp > 0 && dist(p.x, p.y, n.x, n.y) < 60);
  if (!candidates.length) {
    state.message = "No nearby student to command.";
    return;
  }
  const npc = candidates[0];
  const target = nearestOpening(npc.x, npc.y, state.floor);
  if (!target) return;
  npc.busy = 10;
  npc.target = target;
  state.message = `${npc.name} is reinforcing an opening.`;
}

function spawnMonster() {
  const floor = Math.random() < 0.5 ? 0 : 1;
  const side = ["left", "right", "top", "bottom"][Math.floor(Math.random() * 4)];
  let x = 0;
  let y = 0;
  if (side === "left") {
    x = -20;
    y = Math.random() * H;
  } else if (side === "right") {
    x = W + 20;
    y = Math.random() * H;
  } else if (side === "top") {
    x = Math.random() * W;
    y = -20;
  } else {
    x = Math.random() * W;
    y = H + 20;
  }
  const typeRoll = Math.random();
  let type = "crawler";
  if (typeRoll > 0.68) type = "brute";
  if (typeRoll > 0.86) type = "wisp";
  const spec = {
    crawler: { speed: 1.2, dmg: 0.4, hp: diff.monsterHp, c: "#aa6677", r: 10 },
    brute: { speed: 0.75, dmg: 0.75, hp: diff.monsterHp + 15, c: "#6f547d", r: 14 },
    wisp: { speed: 1.6, dmg: 0.25, hp: diff.monsterHp - 5, c: "#8bc4ff", r: 8 },
  }[type];
  state.monsters.push({ x, y, floor, type, ...spec, hp: spec.hp, retreat: false, stun: 0 });
}

function spawnPrincipal() {
  state.principal = {
    x: 9.5 * TILE,
    y: 1.5 * TILE,
    floor: 1,
    hp: 170,
    maxHp: 170,
    r: 20,
    speed: 1.1,
    stun: 0,
  };
  state.message = "The principal mutates into a Wendigo-like cryptid!";
}

function nearestOpening(x, y, floor) {
  let best = null;
  let dBest = 1e9;
  for (const o of state.openings) {
    if (o.floor !== floor) continue;
    const d = dist(x, y, o.x, o.y);
    if (d < dBest) {
      dBest = d;
      best = o;
    }
  }
  return best;
}

function updatePlayer() {
  const p = state.player;
  let vx = 0;
  let vy = 0;
  if (keys.w) vy -= 1;
  if (keys.s) vy += 1;
  if (keys.a) vx -= 1;
  if (keys.d) vx += 1;
  const len = Math.hypot(vx, vy) || 1;
  vx = (vx / len) * p.speed;
  vy = (vy / len) * p.speed;
  moveEntity(p, vx, vy);

  if (mouse.down && p.shootCd <= 0 && p.ammo > 0) {
    p.ammo -= 1;
    p.shootCd = 9;
    const a = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    const dmg = 8 + p.gunLevel * 4;
    state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, life: 42, dmg });
  }
  p.shootCd -= 1;
}

function moveEntity(e, vx, vy) {
  const nx = e.x + vx;
  const ny = e.y + vy;
  if (canWalk(nx, e.y, state.floor)) e.x = nx;
  if (canWalk(e.x, ny, state.floor)) e.y = ny;
  e.x = Math.max(8, Math.min(W - 8, e.x));
  e.y = Math.max(8, Math.min(H - 8, e.y));
}

function canWalk(px, py, floor) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const t = floors[floor][ty]?.[tx];
  return t !== "#";
}

function updateBullets() {
  for (const b of state.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life -= 1;
    for (const m of state.monsters) {
      if (m.floor !== state.floor) continue;
      if (dist(b.x, b.y, m.x, m.y) < m.r + 2) {
        m.hp -= b.dmg;
        m.stun = 20;
        m.retreat = true;
        b.life = 0;
      }
    }
    if (state.principal && state.principal.floor === state.floor && dist(b.x, b.y, state.principal.x, state.principal.y) < state.principal.r + 2) {
      state.principal.hp -= b.dmg;
      state.principal.stun = 10;
      b.life = 0;
      if (state.principal.hp <= 0) {
        state.win = true;
        state.over = true;
        state.message = "You survived the night and defeated the monster principal!";
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -20 && b.y > -20 && b.x < W + 20 && b.y < H + 20);
  state.monsters = state.monsters.filter((m) => m.hp > 0 && m.x > -80 && m.y > -80 && m.x < W + 80 && m.y < H + 80);
}

function updateMonsters() {
  if (Math.random() < 0.012 * diff.monsterRate) spawnMonster();

  for (const m of state.monsters) {
    if (m.stun > 0) {
      m.stun -= 1;
      continue;
    }
    const localOpen = nearestOpening(m.x, m.y, m.floor);
    if (!localOpen) continue;
    let tx = localOpen.x;
    let ty = localOpen.y;

    if (localOpen.barricade <= 0) {
      localOpen.broken = true;
      localOpen.breach = Math.min(100, localOpen.breach + 0.2);
      if (m.floor === state.floor) {
        const p = state.player;
        tx = p.x;
        ty = p.y;
      }
      const targetNpc = state.npcs.find((n) => n.floor === m.floor && n.hp > 0 && dist(m.x, m.y, n.x, n.y) < 140);
      if (targetNpc) {
        tx = targetNpc.x;
        ty = targetNpc.y;
      }
    }

    if (m.retreat) {
      tx = m.x < W / 2 ? -30 : W + 30;
      ty = m.y < H / 2 ? -30 : H + 30;
      if (m.x < -25 || m.y < -25 || m.x > W + 25 || m.y > H + 25) m.hp = -1;
    }

    const a = Math.atan2(ty - m.y, tx - m.x);
    m.x += Math.cos(a) * m.speed;
    m.y += Math.sin(a) * m.speed;

    if (dist(m.x, m.y, localOpen.x, localOpen.y) < 20 && localOpen.barricade > 0) {
      localOpen.barricade = Math.max(0, localOpen.barricade - m.dmg * diff.dmgMult);
    }

    if (m.floor === state.floor && dist(m.x, m.y, state.player.x, state.player.y) < m.r + 8 && localOpen.barricade <= 0) {
      state.player.hp -= 0.07 * diff.dmgMult;
    }
    for (const n of state.npcs) {
      if (n.floor !== m.floor || n.hp <= 0 || localOpen.barricade > 0) continue;
      if (dist(m.x, m.y, n.x, n.y) < m.r + 7) n.hp -= 0.09 * diff.dmgMult;
    }
  }

  if (state.principal) {
    const b = state.principal;
    if (b.stun > 0) b.stun -= 1;
    else {
      if (b.floor === state.floor) {
        const a = Math.atan2(state.player.y - b.y, state.player.x - b.x);
        b.x += Math.cos(a) * b.speed;
        b.y += Math.sin(a) * b.speed;
        if (dist(b.x, b.y, state.player.x, state.player.y) < b.r + 8) state.player.hp -= 0.2 * diff.dmgMult;
      }
    }
  }

  if (state.player.hp <= 0) {
    state.over = true;
    state.message = "You were knocked out. The school falls silent...";
  }
}

function updateNpcs() {
  for (const n of state.npcs) {
    if (n.hp <= 0) continue;
    if (n.busy > 0 && n.target) {
      const a = Math.atan2(n.target.y - n.y, n.target.x - n.x);
      n.x += Math.cos(a) * 1.2;
      n.y += Math.sin(a) * 1.2;
      if (dist(n.x, n.y, n.target.x, n.target.y) < 18) {
        n.target.barricade = Math.min(n.target.maxBarricade, n.target.barricade + 0.3);
      }
      n.busy -= 0.02;
      continue;
    }
    const wobble = Math.sin(state.t * 0.02 + n.x * 0.1) * 0.4;
    moveEntity(n, wobble, -wobble);
  }
}

function drawMap() {
  const map = floors[state.floor];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = map[y][x];
      ctx.fillStyle = t === "#" ? "#2a2540" : "#1a1831";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (t === ".") {
        ctx.strokeStyle = "#201d36";
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  ctx.fillStyle = "#3b5f9f";
  ctx.fillRect(stairA.x - 14, stairA.y - 14, 28, 28);
  ctx.fillRect(stairB.x - 14, stairB.y - 14, 28, 28);

  for (const o of state.openings) {
    if (o.floor !== state.floor) continue;
    const ratio = o.barricade / o.maxBarricade;
    ctx.fillStyle = ratio > 0.5 ? "#8f6e4f" : ratio > 0.2 ? "#704f38" : "#462f24";
    ctx.fillRect(o.x - 14, o.y - 14, 28, 28);
    if (o.barricade <= 0) {
      ctx.strokeStyle = "#ff7388";
      ctx.strokeRect(o.x - 16, o.y - 16, 32, 32);
    }
  }

  if (state.floor === 1) {
    ctx.fillStyle = state.keys.has("office") ? "#7489d8" : "#53345e";
    ctx.fillRect(9 * TILE, 1 * TILE, 2 * TILE, TILE / 2);
    ctx.fillStyle = "#c9bad9";
    ctx.fillText("OFFICE", 9.2 * TILE, 1.35 * TILE);
  }
}

function drawEntities() {
  for (const item of state.pickups) {
    if (item.taken || item.floor !== state.floor) continue;
    const palette = {
      toolkit: "#e0ce7f",
      officeKey: "#9dd3ff",
      ammo: "#ffb0b0",
      wood: "#bb8655",
      flashUpgrade: "#d9f2ff",
      gunUpgrade: "#ffcc7e",
    };
    ctx.fillStyle = palette[item.type];
    ctx.fillRect(item.x - 8, item.y - 8, 16, 16);
  }

  for (const n of state.npcs) {
    if (n.floor !== state.floor || n.hp <= 0) continue;
    ctx.fillStyle = "#6ecf9f";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4ffe8";
    ctx.fillText(n.name, n.x - 10, n.y - 14);
  }

  for (const m of state.monsters) {
    if (m.floor !== state.floor) continue;
    ctx.fillStyle = m.c;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.principal && state.principal.floor === state.floor) {
    ctx.fillStyle = "#d65f90";
    ctx.beginPath();
    ctx.arc(state.principal.x, state.principal.y, state.principal.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe4f1";
    ctx.fillText("MONSTER PRINCIPAL", state.principal.x - 55, state.principal.y - 26);
  }

  for (const b of state.bullets) {
    ctx.fillStyle = "#a8e4ff";
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  const p = state.player;
  ctx.fillStyle = "#8ad3ff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFog() {
  const p = state.player;
  const radius = 110 + p.flashLevel * 35;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "destination-out";
  const g = ctx.createRadialGradient(p.x, p.y, radius * 0.2, p.x, p.y, radius);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawUi() {
  const p = state.player;
  const hp = Math.max(0, p.hp).toFixed(0);
  const openBroken = state.openings.filter((o) => o.floor === state.floor && o.barricade <= 0).length;
  hud.innerHTML = `
    Floor: <b>${state.floor + 1}</b> | HP: <b>${hp}</b> | Ammo: <b>${p.ammo}</b> | Wood: <b>${p.wood}</b> |
    Flashlight Lv <b>${p.flashLevel}</b> | Blaster Lv <b>${p.gunLevel}</b> | Difficulty: <b>${difficulty}</b><br>
    Broken openings on this floor: <b>${openBroken}</b> | Objective: <b>${state.principal ? "Defeat monster principal" : "Find office key and enter office on floor 2"}</b><br>
    ${state.message}
  `;
  if (state.principal) {
    ctx.fillStyle = "#111";
    ctx.fillRect(20, 20, 240, 16);
    ctx.fillStyle = "#ff7ea8";
    ctx.fillRect(20, 20, 240 * (state.principal.hp / state.principal.maxHp), 16);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(20, 20, 240, 16);
  }

  if (state.over) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = state.win ? "#98ffbc" : "#ff9eb0";
    ctx.font = "30px monospace";
    ctx.fillText(state.win ? "YOU WIN" : "YOU WERE KNOCKED OUT", W / 2 - 180, H / 2);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#eee";
    ctx.fillText("Reload page to play again", W / 2 - 130, H / 2 + 38);
  }
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function tick() {
  state.t++;
  if (!state.over) {
    updatePlayer();
    updateBullets();
    updateMonsters();
    updateNpcs();
  }

  ctx.clearRect(0, 0, W, H);
  drawMap();
  drawEntities();
  drawFog();
  drawUi();
  requestAnimationFrame(tick);
}

tick();
