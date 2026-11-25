import { Game } from './game.js';
import { Renderer, FORGE_CARD_RECTS } from './renderer.js';
import { RetroAudio } from './audio.js';
import { LEVELS } from './levels.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

const canvas = document.getElementById('game-canvas');
const audio = new RetroAudio();
const game = new Game(audio);
const renderer = new Renderer(canvas);

const held = new Set();
const justPressed = new Set();

// Touch virtual gamepad state (independent of keyboard so multi-touch works cleanly)
const touchHeld = new Set();
const touchPressed = new Set();
const pointerToAction = new Map();

// Mobile Safari / Chrome require AudioContext unlock inside touchstart/touchend/click
const unlockAudioGesture = () => audio.unlock();
window.addEventListener('touchstart', unlockAudioGesture, { passive: true });
window.addEventListener('touchend', unlockAudioGesture, { passive: true });
window.addEventListener('click', unlockAudioGesture, { passive: true });

const PREVENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

window.addEventListener('keydown', (e) => {
  if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  audio.unlock();

  if (!held.has(e.code)) {
    justPressed.add(e.code);
  }
  held.add(e.code);

  if (e.code === 'KeyP' && (game.state === 'playing' || game.state === 'paused')) {
    game.state = game.state === 'playing' ? 'paused' : 'playing';
  } else if (e.code === 'KeyR' && game.state !== 'title' && game.state !== 'upgrade_pick') {
    game.loadLevel(game.levelIndex, true);
    game.state = 'playing';
  } else if (e.code === 'KeyM') {
    toggleMusic();
  } else if (e.code.startsWith('Digit') && game.state !== 'upgrade_pick') {
    const num = parseInt(e.code.replace('Digit', ''), 10);
    if (num >= 1 && num <= LEVELS.length) {
      game.loadLevel(num - 1, true);
      game.state = 'playing';
    }
  }
});

window.addEventListener('keyup', (e) => {
  held.delete(e.code);
});

window.addEventListener('blur', () => {
  held.clear();
  justPressed.clear();
  touchHeld.clear();
  touchPressed.clear();
  pointerToAction.clear();
  document.querySelectorAll('.tbtn.pressed').forEach((b) => b.classList.remove('pressed'));
});

// Canvas tap / click: Start game, retry, start Loop 2+, or pick Volta Forge cards!
function handleCanvasTap(clientX, clientY) {
  audio.unlock();
  if (game.state === 'title' || game.state === 'game_over') {
    game.startNewGame(0);
    return;
  }
  if (game.state === 'victory') {
    game.startNextLoop();
    return;
  }
  if (game.state === 'paused') {
    game.state = 'playing';
    return;
  }
  if (game.state === 'upgrade_pick') {
    const rect = canvas.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const my = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    FORGE_CARD_RECTS.forEach((r, idx) => {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        game.pickUpgrade(idx);
      }
    });
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleCanvasTap(e.clientX, e.clientY);
});

// Multi-touch virtual gamepad wiring
const touchPad = document.getElementById('touch-pad');
const btnPad = document.getElementById('btn-pad');

function setPadVisible(on) {
  touchPad.classList.toggle('visible', on);
  btnPad.classList.toggle('active', on);
  btnPad.textContent = `PAD: ${on ? 'ON' : 'OFF'}`;
}

const isTouchDevice =
  'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 820;
setPadVisible(isTouchDevice);

btnPad.addEventListener('click', () => {
  setPadVisible(!touchPad.classList.contains('visible'));
});

function pressTouchAction(pointerId, btn) {
  const action = btn.dataset.action;
  if (!action) return;
  audio.unlock();
  pointerToAction.set(pointerId, { action, btn });
  if (!touchHeld.has(action)) {
    touchPressed.add(action);
  }
  touchHeld.add(action);
  btn.classList.add('pressed');

  // Allow pressing Jump/Buster on virtual pad to start/continue from overlays
  if (action === 'jump' || action === 'shoot') {
    if (game.state === 'title' || game.state === 'game_over') {
      game.startNewGame(0);
    } else if (game.state === 'victory') {
      game.startNextLoop();
    }
  }
}

function releaseTouchAction(pointerId) {
  const rec = pointerToAction.get(pointerId);
  if (!rec) return;
  pointerToAction.delete(pointerId);
  rec.btn.classList.remove('pressed');

  // Only clear action if no other active pointer is holding the same action
  let stillHeld = false;
  for (const v of pointerToAction.values()) {
    if (v.action === rec.action) {
      stillHeld = true;
      break;
    }
  }
  if (!stillHeld) {
    touchHeld.delete(rec.action);
  }
}

touchPad.querySelectorAll('.tbtn').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
    pressTouchAction(e.pointerId, btn);
  });
  btn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    releaseTouchAction(e.pointerId);
  });
  btn.addEventListener('pointercancel', (e) => {
    releaseTouchAction(e.pointerId);
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// Toolbar buttons
document.getElementById('btn-pause').addEventListener('click', () => {
  if (game.state === 'playing' || game.state === 'paused') {
    game.state = game.state === 'playing' ? 'paused' : 'playing';
  }
});

const btnCrt = document.getElementById('btn-crt');
const crtOverlay = document.getElementById('crt-overlay');
btnCrt.addEventListener('click', () => {
  const on = crtOverlay.classList.toggle('crt-on');
  btnCrt.classList.toggle('active', on);
  btnCrt.textContent = `CRT: ${on ? 'ON' : 'OFF'}`;
});

const btnMusic = document.getElementById('btn-music');
function toggleMusic() {
  const on = !audio.musicEnabled;
  audio.setMusic(on);
  btnMusic.classList.toggle('active', on);
  btnMusic.textContent = `MUSIC: ${on ? 'ON' : 'OFF'}`;
}
btnMusic.addEventListener('click', toggleMusic);

const btnSfx = document.getElementById('btn-sfx');
btnSfx.addEventListener('click', () => {
  const on = !audio.sfxEnabled;
  audio.setSfx(on);
  btnSfx.classList.toggle('active', on);
  btnSfx.textContent = `SFX: ${on ? 'ON' : 'OFF'}`;
});

document.getElementById('btn-restart').addEventListener('click', () => {
  audio.unlock();
  if (game.state === 'title') {
    game.startNewGame(0);
  } else {
    game.loadLevel(game.levelIndex, true);
    game.state = 'playing';
  }
});

function readInput() {
  const inp = {
    left: held.has('ArrowLeft') || held.has('KeyA') || touchHeld.has('left'),
    right: held.has('ArrowRight') || held.has('KeyD') || touchHeld.has('right'),
    up: held.has('ArrowUp') || held.has('KeyW') || touchHeld.has('up'),
    down: held.has('ArrowDown') || held.has('KeyS') || touchHeld.has('down'),
    jump: held.has('Space') || touchHeld.has('jump'),
    jumpPressed: justPressed.has('Space') || touchPressed.has('jump'),
    slidePressed:
      justPressed.has('ShiftLeft') ||
      justPressed.has('ShiftRight') ||
      touchPressed.has('slide'),
    shoot: held.has('KeyJ') || held.has('KeyX') || touchHeld.has('shoot'),
    shootPressed:
      justPressed.has('KeyJ') || justPressed.has('KeyX') || touchPressed.has('shoot'),
    axePressed:
      justPressed.has('KeyK') || justPressed.has('KeyV') || touchPressed.has('axe'),
    digLeftPressed:
      justPressed.has('KeyQ') || justPressed.has('KeyZ') || touchPressed.has('digLeft'),
    digRightPressed:
      justPressed.has('KeyE') || justPressed.has('KeyC') || touchPressed.has('digRight'),
    boloPressed:
      justPressed.has('KeyL') || justPressed.has('KeyB') || touchPressed.has('bolo'),
    startPressed: justPressed.has('Enter') || justPressed.has('Space'),
    pick1: justPressed.has('Digit1') || justPressed.has('Numpad1'),
    pick2: justPressed.has('Digit2') || justPressed.has('Numpad2'),
    pick3: justPressed.has('Digit3') || justPressed.has('Numpad3'),
  };
  justPressed.clear();
  touchPressed.clear();
  return inp;
}

let lastTime = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  acc += dt;

  while (acc >= STEP) {
    game.update(STEP, readInput());
    acc -= STEP;
  }

  renderer.render(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
