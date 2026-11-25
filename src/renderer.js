import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  HUD_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TILE,
  PALETTE,
  PHYSICS,
} from './constants.js';
import { LEVELS } from './levels.js';
import { UPGRADES, FEATS } from './progression.js';

export const FORGE_CARD_RECTS = [
  { x: 44, y: 262, w: 222, h: 176 },
  { x: 289, y: 262, w: 222, h: 176 },
  { x: 534, y: 262, w: 222, h: 176 },
];

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  render(game) {
    const ctx = this.ctx;
    ctx.save();

    const bgGrad = ctx.createLinearGradient(0, HUD_HEIGHT, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0a0b18');
    bgGrad.addColorStop(1, '#140e24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let y = HUD_HEIGHT; y < CANVAS_HEIGHT; y += TILE_SIZE) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
    }

    ctx.save();
    const sx = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const sy = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    ctx.translate(Math.round(sx), Math.round(HUD_HEIGHT + sy));

    this._drawTorches(ctx, game);
    this._drawTiles(ctx, game);
    this._drawDugWarnings(ctx, game);
    this._drawPortal(ctx, game);
    this._drawPickups(ctx, game);
    this._drawEnemies(ctx, game);
    this._drawPlayer(ctx, game);
    this._drawProjectiles(ctx, game);
    this._drawParticles(ctx, game);
    this._drawPopups(ctx, game);

    ctx.restore();

    this._drawHUD(ctx, game);
    if (game.boss && game.boss.alive && game.state === 'playing') {
      this._drawBossBar(ctx, game.boss);
    }
    if (game.combo >= 2 && game.state === 'playing') {
      this._drawComboMeter(ctx, game);
    }
    if (game.state === 'title') this._drawTitleOverlay(ctx, game);
    else if (game.state === 'paused') this._drawBanner(ctx, 'PAUSED', 'Press P to resume');
    else if (game.state === 'upgrade_pick') this._drawForgeOverlay(ctx, game);
    else if (game.state === 'game_over')
      this._drawBanner(
        ctx,
        'GAME OVER',
        `SCORE: ${game.score} · BEST: ${game.save.data.highScore} · Press ENTER or SPACE to retry`,
        PALETTE.crimson
      );
    else if (game.state === 'victory') this._drawVictoryOverlay(ctx, game);

    this._drawToasts(ctx, game);
    ctx.restore();
  }

  _drawTorches(ctx, game) {
    for (const t of game.torches) {
      const flick = Math.sin(game.time * 12 + t.phase) * 4;
      const rad = 46 + flick;
      const g = ctx.createRadialGradient(t.x, t.y - 4, 2, t.x, t.y - 4, rad);
      g.addColorStop(0, 'rgba(255, 160, 40, 0.32)');
      g.addColorStop(1, 'rgba(255, 80, 10, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(t.x - 3, t.y, 6, 12);
      ctx.fillStyle = PALETTE.appleOrange;
      ctx.fillRect(t.x - 4, t.y - 7, 8, 8);
      ctx.fillStyle = PALETTE.goldBright;
      ctx.fillRect(t.x - 2, t.y - 9 - (flick > 0 ? 2 : 0), 4, 6);
    }
  }

  _drawTiles(ctx, game) {
    for (let ty = 0; ty < GRID_ROWS; ty++) {
      for (let tx = 0; tx < GRID_COLS; tx++) {
        const t = game.grid[ty][tx];
        if (t === TILE.EMPTY || t === TILE.PORTAL) continue;
        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;

        if (t === TILE.BRICK) {
          ctx.fillStyle = PALETTE.brickDark;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = PALETTE.brick;
          ctx.fillRect(x + 1, y + 1, 14, 13);
          ctx.fillRect(x + 17, y + 1, 14, 13);
          ctx.fillRect(x + 1, y + 17, 6, 13);
          ctx.fillRect(x + 9, y + 17, 14, 13);
          ctx.fillRect(x + 25, y + 17, 6, 13);
          ctx.fillStyle = PALETTE.brickHi;
          ctx.fillRect(x + 1, y + 1, 14, 2);
          ctx.fillRect(x + 17, y + 1, 14, 2);
          ctx.fillRect(x + 9, y + 17, 14, 2);
        } else if (t === TILE.STONE) {
          ctx.fillStyle = PALETTE.stoneDark;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = PALETTE.stone;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = PALETTE.stoneHi;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
          ctx.fillRect(x + 2, y + 2, 2, TILE_SIZE - 4);
          ctx.fillStyle = PALETTE.stoneDark;
          ctx.fillRect(x + 5, y + 5, 2, 2);
          ctx.fillRect(x + 25, y + 5, 2, 2);
          ctx.fillRect(x + 5, y + 25, 2, 2);
          ctx.fillRect(x + 25, y + 25, 2, 2);
        } else if (t === TILE.LADDER) {
          ctx.fillStyle = '#c89448';
          ctx.fillRect(x + 5, y, 4, TILE_SIZE);
          ctx.fillRect(x + 23, y, 4, TILE_SIZE);
          ctx.fillStyle = '#f0c068';
          for (let ry = 4; ry < TILE_SIZE; ry += 8) {
            ctx.fillRect(x + 7, y + ry, 18, 3);
          }
        } else if (t === TILE.ROPE) {
          ctx.fillStyle = PALETTE.appleGreen;
          ctx.fillRect(x, y + 6, TILE_SIZE, 3);
          ctx.fillStyle = '#a8ffb8';
          ctx.fillRect(x, y + 6, TILE_SIZE, 1);
        } else if (t === TILE.LAVA) {
          const wave = Math.sin(game.time * 6 + tx * 1.1) * 2;
          ctx.fillStyle = PALETTE.lava;
          ctx.fillRect(x, y + 6 + wave, TILE_SIZE, TILE_SIZE - 6 - wave);
          ctx.fillStyle = PALETTE.lavaGlow;
          ctx.fillRect(x, y + 6 + wave, TILE_SIZE, 4);
        } else if (t === TILE.VOLTA) {
          const coil = game.voltaCoils.find((c) => c.tx === tx && c.ty === ty);
          const phase = coil ? coil.phase : 0;
          const charging = phase >= 1.65 && phase < 2.35;
          const zapping = phase >= 2.35;

          ctx.fillStyle = '#363c58';
          ctx.fillRect(x + 8, y + 18, 16, 14);
          ctx.fillStyle = zapping ? PALETTE.megaCyan : charging ? PALETTE.appleViolet : '#6a7498';
          ctx.fillRect(x + 12, y + 6, 8, 12);
          ctx.fillStyle = zapping ? PALETTE.white : PALETTE.appleCyan;
          ctx.beginPath();
          ctx.arc(x + 16, y + 6, 5, 0, Math.PI * 2);
          ctx.fill();

          if (charging) {
            ctx.strokeStyle = 'rgba(200, 72, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + 16, y + 12, 10 + Math.sin(game.time * 24) * 3, 0, Math.PI * 2);
            ctx.stroke();
          } else if (zapping) {
            ctx.strokeStyle = PALETTE.megaCyan;
            ctx.lineWidth = 2;
            for (let a = 0; a < 4; a++) {
              ctx.beginPath();
              ctx.moveTo(x + 16, y + 6);
              const ang = (a * Math.PI) / 2 + Math.sin(game.time * 35 + a) * 0.4;
              const mx = x + 16 + Math.cos(ang) * 14 + (Math.random() - 0.5) * 6;
              const my = y + 6 + Math.sin(ang) * 14 + (Math.random() - 0.5) * 6;
              const ex = x + 16 + Math.cos(ang) * 26;
              const ey = y + 6 + Math.sin(ang) * 26;
              ctx.lineTo(mx, my);
              ctx.lineTo(ex, ey);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  _drawDugWarnings(ctx, game) {
    for (const d of game.dugBricks) {
      const x = d.tx * TILE_SIZE;
      const y = d.ty * TILE_SIZE;
      if (d.timer <= PHYSICS.BRICK_WARN_TIME) {
        const blink = Math.floor(d.timer * 10) % 2 === 0;
        ctx.fillStyle = blink ? 'rgba(216, 104, 56, 0.55)' : 'rgba(168, 68, 40, 0.25)';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeStyle = PALETTE.appleOrange;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      } else {
        ctx.strokeStyle = 'rgba(216, 104, 56, 0.22)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.setLineDash([]);
      }
    }
  }

  _drawPortal(ctx, game) {
    if (!game.portal) return;
    const { x, y } = game.portal;
    if (!game.portalOpen) {
      ctx.strokeStyle = '#3d4566';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 2, 24, 28);
      ctx.fillStyle = '#181c2e';
      ctx.fillRect(x + 6, y + 4, 20, 24);
      return;
    }
    const pulse = Math.sin(game.time * 8) * 3;
    const g = ctx.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, 22 + pulse);
    g.addColorStop(0, PALETTE.white);
    g.addColorStop(0.45, PALETTE.appleGreen);
    g.addColorStop(1, 'rgba(56, 232, 88, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 22 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = PALETTE.appleGreen;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 3, 22, 26);
  }

  _drawPickups(ctx, game) {
    for (const g of game.golds) {
      if (g.collected) continue;
      const by = Math.sin(g.bob) * 2;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(g.x + 2, g.y + 8 + by, 16, 8);
      ctx.fillRect(g.x + 5, g.y + 3 + by, 10, 6);
      ctx.fillStyle = PALETTE.goldBright;
      ctx.fillRect(g.x + 6, g.y + 4 + by, 4, 3);
      ctx.fillRect(g.x + 11, g.y + 9 + by, 4, 2);
    }

    for (const k of game.powerups) {
      if (k.collected) continue;
      const by = Math.sin(k.bob) * 3;
      ctx.fillStyle = '#1a3848';
      ctx.fillRect(k.x, k.y + by, 20, 20);
      ctx.strokeStyle = PALETTE.appleCyan;
      ctx.lineWidth = 2;
      ctx.strokeRect(k.x + 1, k.y + 1 + by, 18, 18);
      ctx.fillStyle = PALETTE.appleGreen;
      ctx.fillRect(k.x + 6, k.y + 6 + by, 8, 8);
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(k.x + 8, k.y + 8 + by, 4, 4);
    }
  }

  _drawPlayer(ctx, game) {
    const p = game.player;
    if (p.invuln > 0 && Math.floor(game.time * 18) % 2 === 0 && p.sliding <= 0) {
      return;
    }

    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const chargeNeed = game.hasUpgrade('quick_charge') ? PHYSICS.CHARGE_TIME * 0.55 : PHYSICS.CHARGE_TIME;

    if (p.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(56, 232, 88, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 19 + Math.sin(game.time * 14) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.charging && p.chargeTime > 0.12) {
      const full = p.chargeTime >= chargeNeed;
      ctx.strokeStyle = full ? PALETTE.goldBright : PALETTE.megaCyan;
      ctx.lineWidth = full ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 15 + Math.sin(game.time * 32) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (p.somersault > 0 && !p.onGround && !p.onLadder && !p.onRope) {
      ctx.rotate(game.time * 14 * p.facing);
    }
    ctx.scale(p.facing, 1);

    if (p.sliding > 0) {
      ctx.fillStyle = PALETTE.megaBlue;
      ctx.fillRect(-12, 2, 24, 10);
      ctx.fillStyle = PALETTE.megaCyan;
      ctx.fillRect(-6, 4, 14, 6);
      ctx.fillStyle = '#ffd0a8';
      ctx.fillRect(4, -2, 7, 6);
    } else {
      ctx.fillStyle = PALETTE.megaBlue;
      ctx.fillRect(-8, -14, 16, 10);
      ctx.fillStyle = PALETTE.megaCyan;
      ctx.fillRect(-4, -14, 8, 3);
      ctx.fillStyle = '#ffd0a8';
      ctx.fillRect(-2, -10, 9, 6);
      ctx.fillStyle = '#101220';
      ctx.fillRect(3, -9, 2, 2);
      ctx.fillStyle = PALETTE.megaCyan;
      ctx.fillRect(-7, -4, 14, 10);
      ctx.fillStyle = PALETTE.megaBlue;
      ctx.fillRect(-7, -4, 5, 10);
      ctx.fillStyle = p.shootAnim > 0 ? PALETTE.goldBright : PALETTE.megaBlue;
      ctx.fillRect(4, -3, p.shootAnim > 0 ? 10 : 7, 5);
      const stride = Math.abs(p.vx) > 10 || p.onLadder ? Math.sin(p.animTime * 16) * 4 : 0;
      ctx.fillStyle = PALETTE.megaBlue;
      ctx.fillRect(-6, 6, 5, 8 + stride * 0.3);
      ctx.fillRect(1, 6, 5, 8 - stride * 0.3);
    }

    ctx.restore();
  }

  _drawEnemies(ctx, game) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const flash = e.hitFlash > 0;

      if (e.type === 'guard') {
        ctx.fillStyle = flash ? PALETTE.white : PALETTE.crimson;
        ctx.fillRect(e.x + 3, e.y, 16, 9);
        ctx.fillStyle = flash ? PALETTE.white : '#ffd0a8';
        ctx.fillRect(e.x + 6, e.y + 3, 10, 5);
        ctx.fillStyle = flash ? PALETTE.white : '#981838';
        ctx.fillRect(e.x + 4, e.y + 9, 14, 11);
        ctx.fillStyle = flash ? PALETTE.white : PALETTE.appleOrange;
        ctx.fillRect(e.x + 4, e.y + 20, 5, 8);
        ctx.fillRect(e.x + 13, e.y + 20, 5, 8);
        if (e.hasGold) {
          ctx.fillStyle = PALETTE.gold;
          ctx.fillRect(e.x + 6, e.y - 7, 10, 6);
        }
      } else if (e.type === 'bat') {
        const wing = Math.sin(e.anim * 18) * 6;
        ctx.fillStyle = flash ? PALETTE.white : PALETTE.appleViolet;
        ctx.fillRect(e.x + 8, e.y + 4, 8, 10);
        ctx.fillRect(e.x, e.y + 4 + wing * 0.5, 9, 6);
        ctx.fillRect(e.x + 15, e.y + 4 - wing * 0.5, 9, 6);
        ctx.fillStyle = PALETTE.goldBright;
        ctx.fillRect(e.x + 10, e.y + 7, 2, 2);
        ctx.fillRect(e.x + 14, e.y + 7, 2, 2);
      } else if (e.type === 'tank') {
        ctx.fillStyle = flash ? PALETTE.white : PALETTE.tankDark;
        ctx.fillRect(e.x, e.y + 16, e.w, 8);
        ctx.fillStyle = flash ? PALETTE.white : PALETTE.tankGreen;
        ctx.fillRect(e.x + 2, e.y + 6, e.w - 4, 11);
        ctx.fillStyle = PALETTE.steel;
        ctx.fillRect(e.facing > 0 ? e.x + e.w - 4 : e.x, e.y + 6, 4, 12);
        const cx = e.x + e.w / 2;
        const cy = e.y + 9;
        ctx.strokeStyle = flash ? PALETTE.white : PALETTE.appleGreen;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(e.turretAngle) * 14, cy + Math.sin(e.turretAngle) * 14);
        ctx.stroke();
      } else if (e.type === 'pillbox') {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        ctx.fillStyle = flash ? PALETTE.white : '#4a5268';
        ctx.fillRect(e.x, e.y + 4, e.w, e.h - 4);
        ctx.fillStyle = flash ? PALETTE.white : '#282d3e';
        ctx.fillRect(e.x + 4, e.y + 8, e.w - 8, e.h - 12);
        if (e.telegraph > 0) {
          ctx.strokeStyle = `rgba(255, 40, 72, ${0.3 + e.telegraph * 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(e.turretAngle) * 44, cy + Math.sin(e.turretAngle) * 44);
          ctx.stroke();
        }
        ctx.strokeStyle = flash ? PALETTE.white : PALETTE.appleOrange;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(e.turretAngle) * 16, cy + Math.sin(e.turretAngle) * 16);
        ctx.stroke();
        ctx.fillStyle = e.telegraph > 0.5 ? PALETTE.crimson : PALETTE.appleCyan;
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      } else if (e.type === 'boss') {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        ctx.fillStyle = flash ? PALETTE.white : '#3a224e';
        ctx.fillRect(e.x, e.y + 6, e.w, e.h - 10);
        ctx.strokeStyle = PALETTE.appleViolet;
        ctx.lineWidth = 2;
        ctx.strokeRect(e.x + 1, e.y + 7, e.w - 2, e.h - 12);
        ctx.fillStyle = PALETTE.appleCyan;
        ctx.fillRect(e.x + 6, e.y - 4, 8, 12);
        ctx.fillRect(e.x + e.w - 14, e.y - 4, 8, 12);
        ctx.fillStyle = e.hp <= e.maxHp * 0.5 ? PALETTE.crimson : PALETTE.gold;
        ctx.beginPath();
        ctx.arc(cx, cy, 12 + Math.sin(game.time * 12) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.steel;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(e.turretAngle) * 28, cy + Math.sin(e.turretAngle) * 28);
        ctx.stroke();
      }
    }
  }

  _drawProjectiles(ctx, game) {
    for (const pr of game.projectiles) {
      if (pr.type === 'buster') {
        ctx.fillStyle = PALETTE.goldBright;
        ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(pr.x + 2, pr.y + 2, pr.w - 4, pr.h - 4);
      } else if (pr.type === 'charge') {
        ctx.fillStyle = PALETTE.megaCyan;
        ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(pr.x + 4, pr.y + 3, pr.w - 8, pr.h - 6);
      } else if (pr.type === 'axe') {
        ctx.save();
        ctx.translate(pr.x + pr.w / 2, pr.y + pr.h / 2);
        ctx.rotate(pr.spin);
        ctx.fillStyle = '#c88040';
        ctx.fillRect(-2, -9, 4, 18);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(1, -9, 8, 8);
        ctx.fillStyle = PALETTE.appleCyan;
        ctx.fillRect(5, -8, 4, 6);
        ctx.restore();
      } else if (pr.type === 'bolo_shell') {
        ctx.fillStyle = PALETTE.appleOrange;
        ctx.beginPath();
        ctx.arc(pr.x + 6, pr.y + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.goldBright;
        ctx.fillRect(pr.x + 4, pr.y + 4, 4, 4);
      } else {
        ctx.fillStyle = PALETTE.crimson;
        ctx.beginPath();
        ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.goldBright;
        ctx.fillRect(pr.x + pr.w / 2 - 2, pr.y + pr.h / 2 - 2, 4, 4);
      }
    }
  }

  _drawParticles(ctx, game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawPopups(ctx, game) {
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (const pop of game.popups) {
      ctx.globalAlpha = Math.min(1, pop.life * 1.4);
      ctx.fillStyle = '#000';
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }

  _drawHUD(ctx, game) {
    ctx.fillStyle = '#0c0e1c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = '#2a3254';
    ctx.fillRect(0, HUD_HEIGHT - 2, CANVAS_WIDTH, 2);

    const p = game.player;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';

    // HP Bar (scales cleanly with Titan Plating)
    ctx.fillStyle = PALETTE.megaCyan;
    ctx.fillText('HP', 10, 16);
    const segW = p.maxHp > 10 ? 7 : 9;
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? (p.hp <= 3 ? PALETTE.crimson : PALETTE.gold) : '#252a40';
      ctx.fillRect(32 + i * segW, 6, segW - 2, 12);
    }

    // Bolo Energy Bar + active Forge Upgrade pips
    ctx.fillStyle = PALETTE.appleGreen;
    ctx.fillText('BOLO', 10, 35);
    const boloSegs = Math.floor((p.boloEnergy / PHYSICS.BOLO_MAX_ENERGY) * 10);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i < boloSegs ? PALETTE.appleGreen : '#1e2c26';
      ctx.fillRect(46 + i * 7, 25, 5, 11);
    }

    // Active forged upgrade pips next to Bolo bar
    let ux = 124;
    for (const id of game.upgrades) {
      const up = UPGRADES.find((u) => u.id === id);
      if (!up) continue;
      ctx.fillStyle = up.color;
      ctx.fillRect(ux, 26, 8, 9);
      ctx.strokeStyle = '#090a14';
      ctx.lineWidth = 1;
      ctx.strokeRect(ux, 26, 8, 9);
      ux += 10;
    }

    // Center: Chamber name, Loop badge & hint
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.white;
    const loopTag = game.loop > 1 ? ` [LOOP ${game.loop}]` : '';
    ctx.fillText(game.levelDef.name + loopTag, CANVAS_WIDTH / 2 + 12, 16);
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#9aa6cc';
    ctx.fillText(game.levelDef.hint, CANVAS_WIDTH / 2 + 12, 34);

    // Right: Gold, Lives, Score
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px "Courier New", monospace';
    const remGold = game.remainingGold();
    ctx.fillStyle = remGold === 0 ? PALETTE.appleGreen : PALETTE.gold;
    ctx.fillText(remGold === 0 ? 'PORTAL OPEN!' : `GOLD:${remGold}`, CANVAS_WIDTH - 12, 16);
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`LIVES:${game.lives}  ${String(game.score).padStart(6, '0')}`, CANVAS_WIDTH - 12, 35);
  }

  _drawComboMeter(ctx, game) {
    const x = 14;
    const y = HUD_HEIGHT + 12;
    ctx.fillStyle = 'rgba(12, 14, 28, 0.82)';
    ctx.fillRect(x, y, 108, 28);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 108, 28);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = PALETTE.goldBright;
    ctx.fillText(`COMBO x${game.combo}`, x + 8, y + 15);

    const frac = Math.max(0, Math.min(1, game.comboTimer / 4.2));
    ctx.fillStyle = '#262b44';
    ctx.fillRect(x + 8, y + 20, 92, 4);
    ctx.fillStyle = PALETTE.appleOrange;
    ctx.fillRect(x + 8, y + 20, 92 * frac, 4);
  }

  _drawBossBar(ctx, boss) {
    const x = CANVAS_WIDTH - 24;
    const y = HUD_HEIGHT + 24;
    const h = 160;
    ctx.fillStyle = '#10121e';
    ctx.fillRect(x - 3, y - 3, 16, h + 6);
    ctx.strokeStyle = PALETTE.appleViolet;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 3, 16, h + 6);

    const segs = 20;
    const filled = Math.ceil((boss.hp / boss.maxHp) * segs);
    for (let i = 0; i < segs; i++) {
      const sy = y + h - (i + 1) * (h / segs) + 1;
      ctx.fillStyle = i < filled ? PALETTE.appleOrange : '#261c2e';
      ctx.fillRect(x, sy, 10, h / segs - 2);
    }
  }

  _drawForgeOverlay(ctx, game) {
    ctx.fillStyle = 'rgba(7, 8, 16, 0.9)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

    const sum = game.lastClearSummary;
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = PALETTE.appleGreen;
    ctx.fillText('CHAMBER CLEARED — VOLTA FORGE', CANVAS_WIDTH / 2, 92);

    if (sum) {
      const rankColors = { S: PALETTE.goldBright, A: PALETTE.appleGreen, B: PALETTE.appleCyan, C: '#aab4d6' };
      ctx.font = 'bold 54px "Courier New", monospace';
      ctx.fillStyle = rankColors[sum.rank] || PALETTE.white;
      ctx.fillText(sum.rank, 150, 174);
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillStyle = '#9aa6cc';
      ctx.fillText('CHAMBER RANK', 150, 194);

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle = PALETTE.white;
      ctx.fillText(`TIME: ${sum.timeSec.toFixed(1)}s`, 255, 138);
      ctx.fillStyle = sum.flawless ? PALETTE.appleGreen : '#9aa6cc';
      ctx.fillText(sum.flawless ? 'FLAWLESS CLEAR (+500!)' : 'DAMAGE TAKEN', 255, 160);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`MAX COMBO: x${Math.max(1, sum.maxCombo)}   CLEAR BONUS: +${sum.bonus}`, 255, 182);
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = PALETTE.megaCyan;
    ctx.fillText('FORGE 1 PERMANENT UPGRADE — PRESS [1], [2], [3] OR CLICK A CARD', CANVAS_WIDTH / 2, 240);

    game.upgradeChoices.forEach((up, idx) => {
      const r = FORGE_CARD_RECTS[idx];
      ctx.fillStyle = '#14182b';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = up.color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // Key badge
      ctx.fillStyle = up.color;
      ctx.fillRect(r.x + 10, r.y + 10, 28, 22);
      ctx.fillStyle = '#090a14';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[${idx + 1}]`, r.x + 24, r.y + 26);

      // Origin game tag
      ctx.textAlign = 'right';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = up.color;
      ctx.fillText(up.tag, r.x + r.w - 12, r.y + 25);

      // Name
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = PALETTE.white;
      ctx.fillText(up.name, r.x + r.w / 2, r.y + 66);

      // Description wrapped
      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#c8d2f0';
      const lines = wrapText(ctx, up.desc, r.w - 24);
      lines.forEach((ln, li) => {
        ctx.fillText(ln, r.x + r.w / 2, r.y + 98 + li * 20);
      });
    });

    ctx.textAlign = 'center';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#8b96bd';
    ctx.fillText(`FORGED THIS RUN: ${game.upgrades.size}/${UPGRADES.length} UPGRADES`, CANVAS_WIDTH / 2, 474);
  }

  _drawVictoryOverlay(ctx, game) {
    ctx.fillStyle = 'rgba(7, 8, 16, 0.88)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillStyle = PALETTE.goldBright;
    ctx.fillText(`LOOP ${game.loop} CLEARED — VOLTA DEFEATED!`, CANVAS_WIDTH / 2, 180);

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`SCORE: ${game.score}   ·   HIGH SCORE: ${game.save.data.highScore}`, CANVAS_WIDTH / 2, 224);

    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = PALETTE.appleCyan;
    ctx.fillText(`FORGED UPGRADES KEPT: ${game.upgrades.size}   ·   FEATS: ${game.save.data.feats.length}/${FEATS.length}`, CANVAS_WIDTH / 2, 260);

    const blink = Math.floor(game.time * 2.6) % 2 === 0;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = blink ? PALETTE.appleGreen : PALETTE.goldBright;
    ctx.fillText(`PRESS ENTER OR SPACE FOR NEW GAME+ (LOOP ${game.loop + 1})!`, CANVAS_WIDTH / 2, 336);

    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#9aa6cc';
    ctx.fillText('Keep all Forge Upgrades · +1 Life · Tougher Enemies · Score Multiplier Increased!', CANVAS_WIDTH / 2, 370);
  }

  _drawTitleOverlay(ctx, game) {
    ctx.fillStyle = 'rgba(7, 8, 16, 0.86)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillStyle = PALETTE.appleGreen;
    ctx.fillText('VOLTA RUNNER', CANVAS_WIDTH / 2, 148);

    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = PALETTE.appleViolet;
    ctx.fillText('APPLE II LODE RUNNER × CONAN × MEGA MAN × BOLO', CANVAS_WIDTH / 2, 176);

    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#d8e0ff';
    const lines = [
      '• LODE RUNNER: Climb ladders/ropes, steal Gold, dig bricks (Q/E) to trap & crush Guards',
      '• CONAN: Leap lava & Volta coils, throw the Boomerang Axe (K) through walls',
      '• MEGA MAN: Tight run/jump, Mega Slide (Shift), rapid & Charged Buster (hold J)',
      '• BOLO: Outsmart Pillboxes & Armored Tanks, blast bunkers with Bolo Mortar (L)',
      '• PROGRESSION: Chain Combos, earn S-Ranks, draft Forge Upgrades & loop New Game+!',
    ];
    lines.forEach((l, i) => ctx.fillText(l, CANVAS_WIDTH / 2, 214 + i * 24));

    // Persistent meta-stats bar
    const s = game.save.data;
    const rankStr = LEVELS.map((_, i) => `${i + 1}:${s.bestRanks[i] || '-'}`).join('  ');
    ctx.fillStyle = '#14182c';
    ctx.fillRect(110, 344, 580, 48);
    ctx.strokeStyle = '#364068';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(110, 344, 580, 48);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`HIGH SCORE: ${s.highScore}   ·   BEST LOOP: ${s.bestLoop}   ·   FEATS: ${s.feats.length}/${FEATS.length}`, CANVAS_WIDTH / 2, 364);
    ctx.fillStyle = PALETTE.appleCyan;
    ctx.fillText(`BEST RANKS:  ${rankStr}`, CANVAS_WIDTH / 2, 383);

    const blink = Math.floor(game.time * 2.6) % 2 === 0;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = blink ? PALETTE.goldBright : PALETTE.appleCyan;
    ctx.fillText('PRESS ENTER OR SPACE TO START', CANVAS_WIDTH / 2, 434);

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#8b96bd';
    ctx.fillText(`5 CHAMBERS + BOSS ARENA · PRESS 1–${LEVELS.length} DURING PLAY TO WARP`, CANVAS_WIDTH / 2, 462);
  }

  _drawToasts(ctx, game) {
    if (!game.toasts.length) return;
    const t = game.toasts[0];
    const w = 360;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = HUD_HEIGHT + 10;
    ctx.fillStyle = 'rgba(16, 22, 40, 0.94)';
    ctx.fillRect(x, y, w, 40);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 40);
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = PALETTE.goldBright;
    ctx.fillText(t.title, CANVAS_WIDTH / 2, y + 17);
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#d0daff';
    ctx.fillText(t.desc, CANVAS_WIDTH / 2, y + 32);
  }

  _drawBanner(ctx, title, sub, color = PALETTE.appleCyan) {
    ctx.fillStyle = 'rgba(7, 8, 16, 0.8)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.fillText(title, CANVAS_WIDTH / 2, 260);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(sub, CANVAS_WIDTH / 2, 298);
  }
}
