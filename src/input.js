import { clamp } from './util.js';

// Três formas de jogar, todas traduzidas para as mesmas "teclas" que o resto do jogo lê:
//  - teclado e mouse (o original)
//  - controle de videogame por Bluetooth/USB (Gamepad API, mapeamento "standard" de Xbox/PlayStation)
//  - controle remoto da TV (só setas, OK e poucas teclas, uma de cada vez)

const keys = new Set();
const pressed = new Set(); // teclas apertadas neste quadro
const lastSeen = new Map(); // último keydown de cada tecla (para o controle remoto da TV)
let mouseX = 0;
let mouseY = 0;
let dragging = false;

// Teclas virtuais vindas do controle, de 0 a 1 (analógico)
const virt = new Map();
// Teclas ignoradas neste quadro (ajudas do modo TV)
const masked = new Set();

// Muitos controles de TV não mandam "tecla segura": repetem keydown/keyup em rajada.
// No modo TV a tecla conta como segura até HOLD_MS depois do último sinal.
const HOLD_MS = 220;
const TV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);

// Controles de TV às vezes não preenchem e.code; traduzimos por e.key / keyCode
const KEY_ALIASES = {
  Enter: 'Enter',
  Select: 'Enter',
  Accept: 'Enter',
  ColorF0Red: 'KeyH',
  ColorF1Green: 'KeyG',
  MediaPlayPause: 'Enter',
};
const KEYCODE_ALIASES = { 13: 'Enter', 23: 'Enter', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 403: 'KeyH', 404: 'KeyG' };
// No controle remoto da TV, as teclas 1 e 2 também servem para dia/noite e qualidade
const TV_DIGITS = { Digit1: 'KeyH', Numpad1: 'KeyH', Digit2: 'KeyG', Numpad2: 'KeyG' };

function codeOf(e) {
  let code = e.code || KEY_ALIASES[e.key] || KEYCODE_ALIASES[e.keyCode] || '';
  if (code === 'NumpadEnter') code = 'Enter';
  if (state.device === 'tv' && TV_DIGITS[code]) code = TV_DIGITS[code];
  return code;
}

const state = {
  device: 'keyboard', // 'keyboard' | 'gamepad' | 'tv'
  // Velocidade escolhida a pé no modo TV: 0 parado, 1 andando, 2 correndo
  footGear: 0,
  // Giro da câmera pedido pelo controle remoto da TV (-1..1)
  turn: 0,
};

function recentlyHeld(code, now = performance.now()) {
  return state.device === 'tv' && TV_KEYS.has(code) && now - (lastSeen.get(code) ?? -1e9) < HOLD_MS;
}

addEventListener('keydown', (e) => {
  const code = codeOf(e);
  if (!code) return;
  // Mexeu no teclado de verdade: volta aos controles de teclado
  if (/^Key[WASDF]$|^Shift/.test(e.code)) state.device = 'keyboard';
  const now = performance.now();
  if (!keys.has(code) && !recentlyHeld(code, now)) pressed.add(code);
  keys.add(code);
  lastSeen.set(code, now);
  if (code === 'Space' || code === 'Enter' || code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(codeOf(e)));
addEventListener('blur', () => keys.clear());

// Mouse travado (pointer lock) ou, sem trava, arrastando com o botão apertado
addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement && !dragging) return;
  mouseX += e.movementX;
  mouseY += e.movementY;
});

// ---------- Controle de videogame ----------

// Botões no mapeamento "standard" (Xbox: A B X Y · PlayStation: ✕ ○ □ △)
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.18;
let prevButtons = [];
let padIndex = null;

const dead = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

function activePad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (padIndex !== null && pads[padIndex]?.connected) return pads[padIndex];
  // Usa o primeiro controle que tiver algum botão apertado (ou o primeiro conectado)
  for (const p of pads) {
    if (p?.connected && p.buttons.some((b) => b.pressed)) {
      padIndex = p.index;
      return p;
    }
  }
  return null;
}

const listeners = new Set();
addEventListener('gamepadconnected', (e) => listeners.forEach((fn) => fn('connected', e.gamepad)));
addEventListener('gamepaddisconnected', (e) => {
  if (e.gamepad.index === padIndex) padIndex = null;
  listeners.forEach((fn) => fn('disconnected', e.gamepad));
});

function setVirt(code, v) {
  if (v > (virt.get(code) ?? 0)) virt.set(code, v);
}

function readGamepad(dt, ctx) {
  const pad = activePad();
  if (!pad) {
    prevButtons = [];
    return;
  }
  const b = (i) => pad.buttons[i]?.value ?? 0;
  const isDown = (i) => !!pad.buttons[i]?.pressed;
  const tapped = (i) => isDown(i) && !prevButtons[i];
  const lx = dead(pad.axes[0] ?? 0);
  const ly = dead(pad.axes[1] ?? 0);
  const rx = dead(pad.axes[2] ?? 0);
  const ry = dead(pad.axes[3] ?? 0);

  if (pad.buttons.some((x) => x.pressed) || lx || ly || rx || ry) state.device = 'gamepad';

  // Comuns a todos os modos
  if (tapped(BTN.START)) pressed.add('Enter');
  if (tapped(BTN.Y)) pressed.add('KeyF');
  if (tapped(BTN.SELECT) || tapped(BTN.UP)) pressed.add('KeyH');
  if (tapped(BTN.DOWN)) pressed.add('KeyG');

  if (ctx.mode === 'foot') {
    setVirt('KeyW', Math.max(0, -ly));
    setVirt('KeyS', Math.max(0, ly));
    setVirt('KeyA', Math.max(0, -lx));
    setVirt('KeyD', Math.max(0, lx));
    if (isDown(BTN.B) || isDown(BTN.LS) || isDown(BTN.RT)) setVirt('ShiftLeft', 1);
    if (tapped(BTN.A)) pressed.add('Space');
  } else if (ctx.mode === 'car') {
    setVirt('KeyW', Math.max(b(BTN.RT), isDown(BTN.A) ? 1 : 0));
    setVirt('KeyS', Math.max(b(BTN.LT), isDown(BTN.X) ? 1 : 0));
    setVirt('KeyA', Math.max(0, -lx)); // o carro lê ('KeyD', 'KeyA'): A vira à esquerda
    setVirt('KeyD', Math.max(0, lx));
    if (isDown(BTN.B) || isDown(BTN.RB)) setVirt('Space', 1);
  } else if (ctx.mode === 'plane') {
    setVirt('KeyW', b(BTN.RT));
    setVirt('KeyS', b(BTN.LT));
    setVirt('ArrowUp', Math.max(0, -ly)); // stick para cima = nariz para cima (igual às setas)
    setVirt('ArrowDown', Math.max(0, ly));
    setVirt('ArrowLeft', Math.max(0, -lx));
    setVirt('ArrowRight', Math.max(0, lx));
    // Leme nos gatilhos de cima; no chão o stick também guia o avião
    setVirt('KeyA', Math.max(isDown(BTN.LB) ? 1 : 0, ctx.plane.onGround ? Math.max(0, -lx) : 0));
    setVirt('KeyD', Math.max(isDown(BTN.RB) ? 1 : 0, ctx.plane.onGround ? Math.max(0, lx) : 0));
    if (isDown(BTN.A) || isDown(BTN.B)) setVirt('Space', 1);
  }

  // Stick direito gira a câmera (vira "movimento de mouse")
  if (ctx.mode !== 'plane') {
    mouseX += rx * 950 * dt;
    mouseY += ry * 650 * dt;
  }

  prevButtons = pad.buttons.map((x) => x.pressed);
}

// ---------- Controle remoto da TV ----------
// Só setas + OK, e quase sempre uma tecla de cada vez. Por isso:
//  - a pé:   ↑ anda / corre, ↓ desacelera / para, ← → gira
//  - carro:  ↑ acelera, ↓ freia / ré, ← → vira; a velocidade se mantém sozinha (piloto automático)
//  - avião:  no chão ↑ liga o motor e decola, ↓ freia; no ar ↑ ↓ nariz, ← → curva
function readTv(dt, ctx) {
  if (state.device !== 'tv') return;
  const held = (c) => keys.has(c) || recentlyHeld(c);
  const up = held('ArrowUp');
  const down = held('ArrowDown');
  const left = held('ArrowLeft');
  const right = held('ArrowRight');
  state.turn = 0;

  if (ctx.mode === 'foot') {
    if (pressed.has('ArrowUp')) state.footGear = Math.min(2, state.footGear + 1);
    if (pressed.has('ArrowDown')) state.footGear = Math.max(0, state.footGear - 1);
    if (state.footGear > 0) setVirt('KeyW', 1);
    if (state.footGear > 1) setVirt('ShiftLeft', 1);
    state.turn = (left ? 1 : 0) - (right ? 1 : 0);
  } else {
    state.footGear = 0;
  }

  if (ctx.mode === 'car') {
    if (up) setVirt('KeyW', 1);
    if (down) setVirt('KeyS', 1);
    if (left) setVirt('KeyA', 1);
    if (right) setVirt('KeyD', 1);
  } else if (ctx.mode === 'plane') {
    const pl = ctx.plane;
    // As setas já levantam/baixam o nariz e inclinam; aqui só acrescentamos o resto
    if (pl.onGround) {
      if (up) setVirt('KeyW', 1);
      if (down) {
        setVirt('KeyS', 1);
        setVirt('Space', 1);
      }
      if (left) setVirt('KeyA', 1);
      if (right) setVirt('KeyD', 1);
    } else {
      const vy = pl.vel.y; // m/s, negativo descendo
      // "Perto do chão" = menos de ~5 s até tocar, ou abaixo de 60 m
      const low = pl.pos.y < 60 + Math.max(0, -vy) * 5;
      // Motor no máximo; na aproximação com ↓ fica em ~1,2× a velocidade de decolagem
      const lift = pl.cfg.liftSpeed;
      if (low && down) {
        if (pl.speed > lift * 1.3) setVirt('KeyS', 1);
        else if (pl.speed < lift * 1.15) setVirt('KeyW', 1);
      } else if (pl.throttle < 1) setVirt('KeyW', 1);
      // Com ↑ ou ↓ seguros o nariz não passa de ~25°, para não perder velocidade e cair
      if (pl.fwd.y > 0.42) masked.add('ArrowUp');
      if (pl.fwd.y < -0.42) masked.add('ArrowDown');
      // Perto do chão não deixa descer rápido demais: levanta o nariz sozinho
      if (low && vy < -4) {
        masked.add('ArrowDown');
        setVirt('ArrowUp', 1);
      }
    }
  }

  // Seta presa pelo atraso (HOLD_MS) também conta para o avião ler direto
  for (const c of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) if (held(c) && !keys.has(c)) setVirt(c, 1);
  if (pressed.has('Enter')) pressed.add('KeyF');
}

// Valor de 0 a 1 de uma tecla (real ou virtual)
const value = (code) => (masked.has(code) ? 0 : Math.max(keys.has(code) ? 1 : 0, virt.get(code) ?? 0));

export const input = {
  down: (code) => value(code) > 0.5,
  pressed: (code) => pressed.has(code),
  // -1 a 1 conforme as duas teclas (analógico no controle)
  axis: (neg, pos) => clamp(value(pos) - value(neg), -1, 1),
  consumeMouse() {
    const d = { x: mouseX, y: mouseY };
    mouseX = mouseY = 0;
    return d;
  },
  // Chamar no começo de cada quadro, antes de ler as teclas
  update(dt, ctx) {
    virt.clear();
    masked.clear();
    readGamepad(dt, ctx);
    readTv(dt, ctx);
  },
  endFrame: () => pressed.clear(),
  get device() {
    return state.device;
  },
  set device(d) {
    state.device = d;
    if (d !== 'tv') state.footGear = 0;
  },
  // No modo TV o carro mantém a velocidade sem precisar segurar ↑
  get cruise() {
    return state.device === 'tv';
  },
  get turn() {
    return state.turn;
  },
  hasGamepad: () => !!activePad() || [...(navigator.getGamepads?.() ?? [])].some((p) => p?.connected),
  onGamepad: (fn) => listeners.add(fn),
};

// A tela inicial também escuta o controle antes do jogo começar
export function pollStart() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (p?.connected && (p.buttons[BTN.START]?.pressed || p.buttons[BTN.A]?.pressed)) {
      padIndex = p.index;
      prevButtons = p.buttons.map((x) => x.pressed);
      return true;
    }
  }
  return false;
}
