import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TILE,
  PHYSICS,
  PALETTE,
} from './constants.js';
import { LEVELS } from './levels.js';
import {
  UPGRADES,
  FEATS,
  SaveStore,
  computeChamberRank,
  rollUpgradeChoices,
} from './progression.js';

function rectOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export class Game {
  constructor(audio = null) {
    this.audio = audio;
    this.save = new SaveStore();
    // 'title' | 'playing' | 'paused' | 'upgrade_pick' | 'game_over' | 'victory'
    this.state = 'title';
    this.levelIndex = 0;
    this.loop = 1; // New Game+ loop counter!
    this.score = 0;
    this.lives = 3;
    this.time = 0;
    this.shake = 0;
    this.hitstop = 0;

    // Progression state
    this.upgrades = new Set();
    this.upgradeChoices = [];
    this.lastClearSummary = null;
    this.toasts = []; // achievement / unlock banners
    this.killsThisRun = 0;

    // Per-chamber style / speed tracking
    this.chamberTime = 0;
    this.chamberDamage = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    // World data
    this.grid = [];
    this.dugBricks = [];
    this.torches = [];
    this.voltaCoils = [];
    this.golds = [];
    this.powerups = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.portal = null;
    this.portalOpen = false;
    this.boss = null;

    this.player = null;
    this.loadLevel(0, true);
    this.state = 'title';
  }

  hasUpgrade(id) {
    return this.upgrades.has(id);
  }

  sfx(name) {
    if (this.audio) this.audio.play(name);
  }

  unlockFeat(id) {
    if (this.save.unlockFeat(id)) {
      const feat = FEATS.find((f) => f.id === id);
      if (feat) {
        this.toasts.push({
          title: `FEAT UNLOCKED: ${feat.name}`,
          desc: feat.desc,
          timer: 3.4,
        });
        this.sfx('powerup');
      }
    }
  }

  addScore(basePts, x, y, label = '', color = PALETTE.goldBright, triggerCombo = true) {
    if (triggerCombo) {
      this.combo = Math.min(8, this.combo + 1);
      this.comboTimer = 4.2;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (this.combo >= 5) this.unlockFeat('combo_king');
    }
    const mult = Math.max(1, this.combo) * this.loop;
    const pts = basePts * mult;
    this.score += pts;
    this.save.recordScore(this.score, this.loop);
    const text = label
      ? `${label} +${pts}${mult > 1 ? ` (x${mult})` : ''}`
      : `+${pts}${mult > 1 ? ` x${mult}` : ''}`;
    if (x !== undefined && y !== undefined) {
      this.addPopup(x, y, text, color);
    }
    return pts;
  }

  startNewGame(levelIdx = 0) {
    this.score = 0;
    this.lives = 3;
    this.loop = 1;
    this.killsThisRun = 0;
    this.upgrades = new Set();
    this.upgradeChoices = [];
    this.lastClearSummary = null;
    this.save.data.runsPlayed++;
    this.save.save();
    this.loadLevel(levelIdx, true);
    this.state = 'playing';
  }

  startNextLoop() {
    this.loop++;
    this.lives = Math.min(5, this.lives + 1);
    this.save.recordScore(this.score, this.loop);
    this.loadLevel(0, true);
    this.state = 'playing';
    this.toasts.push({
      title: `VOLTA LOOP ${this.loop} — OVERCLOCKED!`,
      desc: `All Forge upgrades kept! Score x${this.loop}, tougher foes!`,
      timer: 3.5,
    });
  }

  pickUpgrade(choiceIdx) {
    if (this.state !== 'upgrade_pick') return false;
    const chosen = this.upgradeChoices[choiceIdx];
    if (!chosen) return false;

    this.upgrades.add(chosen.id);
    this.sfx('powerup');

    if (chosen.id === 'titan_plating' && this.player) {
      this.player.maxHp += 4;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
    }

    if (this.levelIndex + 1 < LEVELS.length) {
      this.loadLevel(this.levelIndex + 1, false);
      this.state = 'playing';
    } else {
      this.state = 'victory';
    }
    return true;
  }

  loadLevel(index, fullHeal = true) {
    this.levelIndex = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
    const def = LEVELS[this.levelIndex];
    this.levelDef = def;

    this.chamberTime = 0;
    this.chamberDamage = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(TILE.EMPTY)
    );
    this.dugBricks = [];
    this.torches = [];
    this.voltaCoils = [];
    this.golds = [];
    this.powerups = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.portal = null;
    this.portalOpen = false;
    this.boss = null;
    this.shake = 0;
    this.hitstop = 0;

    let spawnX = TILE_SIZE * 2;
    let spawnY = TILE_SIZE * 12;

    for (let ty = 0; ty < GRID_ROWS; ty++) {
      const row = def.map[ty];
      for (let tx = 0; tx < GRID_COLS; tx++) {
        const ch = row[tx] || '.';
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        switch (ch) {
          case '#':
            this.grid[ty][tx] = TILE.BRICK;
            break;
          case '=':
            this.grid[ty][tx] = TILE.STONE;
            break;
          case 'H':
            this.grid[ty][tx] = TILE.LADDER;
            break;
          case '-':
            this.grid[ty][tx] = TILE.ROPE;
            break;
          case '~':
            this.grid[ty][tx] = TILE.LAVA;
            break;
          case '^':
            this.grid[ty][tx] = TILE.VOLTA;
            this.voltaCoils.push({ tx, ty, phase: (tx * 0.7 + ty * 0.3) % 3.2 });
            break;
          case 'P':
            this.grid[ty][tx] = TILE.PORTAL;
            this.portal = { tx, ty, x: px, y: py, w: TILE_SIZE, h: TILE_SIZE };
            break;
          case 'T':
            this.torches.push({ x: px + 16, y: py + 16, phase: Math.random() * 6 });
            break;
          case 'G':
            this.golds.push({
              x: px + 6,
              y: py + 10,
              w: 20,
              h: 18,
              collected: false,
              bob: Math.random() * 6,
            });
            break;
          case 'K':
            this.powerups.push({
              x: px + 6,
              y: py + 6,
              w: 20,
              h: 20,
              collected: false,
              bob: Math.random() * 6,
            });
            break;
          case '@':
            spawnX = px + 6;
            spawnY = py + 4;
            break;
          case 'E':
            this.enemies.push(this._makeGuard(px + 5, py + 4));
            break;
          case 'F':
            this.enemies.push(this._makeBat(px + 4, py + 6));
            break;
          case 'M':
            this.enemies.push(this._makeTank(px + 2, py + 6));
            break;
          case 'B':
            this.enemies.push(this._makePillbox(px + 3, py + 4));
            break;
          case 'V': {
            const b = this._makeBoss(px - 16, py - 12);
            this.enemies.push(b);
            this.boss = b;
            break;
          }
        }
      }
    }

    const baseMaxHp = 10 + (this.hasUpgrade('titan_plating') ? 4 : 0);
    const prevHp = this.player ? this.player.hp : baseMaxHp;
    this.player = {
      x: spawnX,
      y: spawnY,
      w: 20,
      h: 28,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      onLadder: false,
      onRope: false,
      coyote: 0,
      jumpBuf: 0,
      sliding: 0,
      slideCd: 0,
      invuln: 0.6,
      shieldTimer: 0,
      hp: fullHeal ? baseMaxHp : Math.min(baseMaxHp, Math.max(Math.ceil(baseMaxHp * 0.6), prevHp + 2)),
      maxHp: baseMaxHp,
      boloEnergy: PHYSICS.BOLO_MAX_ENERGY,
      charging: false,
      chargeTime: 0,
      shootAnim: 0,
      digAnim: 0,
      animTime: 0,
      somersault: 0,
      spawnX,
      spawnY,
    };

    if (this.audio) {
      this.audio.setBossMode(!!def.boss);
    }
  }

  _loopHp(base) {
    return Math.round(base * (1 + (this.loop - 1) * 0.35));
  }

  _makeGuard(x, y) {
    const hp = this._loopHp(3);
    return {
      type: 'guard',
      x, y, w: 22, h: 28, vx: 0, vy: 0, facing: -1,
      hp, maxHp: hp, trapped: 0, trapTx: -1, trapTy: -1,
      hasGold: false, hitFlash: 0, anim: Math.random() * 6, alive: true,
    };
  }

  _makeBat(x, y) {
    const hp = this._loopHp(2);
    return {
      type: 'bat',
      x, y, baseY: y, w: 24, h: 18, vx: -75 - (this.loop - 1) * 15, vy: 0, facing: -1,
      hp, maxHp: hp, hitFlash: 0, anim: Math.random() * 6, alive: true,
    };
  }

  _makeTank(x, y) {
    const hp = this._loopHp(6);
    return {
      type: 'tank',
      x, y, w: 28, h: 24, vx: -55, vy: 0, facing: -1,
      turretAngle: Math.PI, fireCd: 1.6 + Math.random(),
      hp, maxHp: hp, trapped: 0, trapTx: -1, trapTy: -1,
      hitFlash: 0, anim: 0, alive: true,
    };
  }

  _makePillbox(x, y) {
    const hp = this._loopHp(5);
    return {
      type: 'pillbox',
      x, y, w: 26, h: 26, vx: 0, vy: 0,
      turretAngle: Math.PI, fireCd: 1.4 + Math.random() * 1.2, telegraph: 0,
      hp, maxHp: hp, hitFlash: 0, anim: 0, alive: true,
    };
  }

  _makeBoss(x, y) {
    const hp = this._loopHp(40);
    return {
      type: 'boss',
      x, y, w: 64, h: 56, vx: 65, vy: 0, facing: -1,
      turretAngle: Math.PI, hp, maxHp: hp,
      attackCd: 1.8, summonCd: 7.0, patternIdx: 0,
      hitFlash: 0, anim: 0, alive: true,
    };
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS) {
      return TILE.STONE;
    }
    return this.grid[ty][tx];
  }

  isSolid(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t === TILE.BRICK || t === TILE.STONE;
  }

  isDugAt(tx, ty) {
    return this.dugBricks.some((d) => d.tx === tx && d.ty === ty);
  }

  spawnParticles(x, y, color, count = 10, speed = 160) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        color,
        size: 2 + Math.floor(Math.random() * 3),
      });
    }
  }

  addPopup(x, y, text, color = PALETTE.goldBright) {
    this.popups.push({ x, y, text, color, life: 0.95 });
  }

  update(dt, input) {
    this.time += dt;

    // Update achievement toasts in all states
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].timer -= dt;
      if (this.toasts[i].timer <= 0) this.toasts.splice(i, 1);
    }

    if (this.state === 'title') {
      if (input.startPressed || input.jumpPressed) {
        this.startNewGame(0);
      }
      return;
    }

    if (this.state === 'paused') return;

    if (this.state === 'upgrade_pick') {
      this._updateParticles(dt);
      if (input.pick1) this.pickUpgrade(0);
      else if (input.pick2) this.pickUpgrade(1);
      else if (input.pick3) this.pickUpgrade(2);
      return;
    }

    if (this.state === 'game_over') {
      this._updateParticles(dt);
      if (input.startPressed) {
        this.startNewGame(0);
      }
      return;
    }

    if (this.state === 'victory') {
      this._updateParticles(dt);
      if (input.startPressed) {
        this.startNextLoop();
      }
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 28);
    }

    this.chamberTime += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    this._updateDugBricks(dt);
    this._updateVoltaCoils(dt);
    this._updatePlayer(dt, input);
    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updatePickups(dt);
    this._updateParticles(dt);
    this._checkPortal();
  }

  _updateDugBricks(dt) {
    for (let i = this.dugBricks.length - 1; i >= 0; i--) {
      const d = this.dugBricks[i];
      d.timer -= dt;
      if (d.timer <= 0) {
        this.grid[d.ty][d.tx] = TILE.BRICK;
        this.dugBricks.splice(i, 1);
        this.sfx('brickRegen');

        const brickRect = {
          x: d.tx * TILE_SIZE,
          y: d.ty * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
        };

        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (
            (e.trapped > 0 && e.trapTx === d.tx && e.trapTy === d.ty) ||
            (e.type !== 'bat' && e.type !== 'boss' && rectOverlap(e, brickRect))
          ) {
            e.alive = false;
            const bonus = this.hasUpgrade('lode_master') ? 450 : 250;
            this.addScore(bonus, e.x, e.y - 6, 'CRUSH', PALETTE.appleOrange, true);
            this.unlockFeat('brick_crusher');
            if (this.hasUpgrade('lode_master')) {
              this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
            }
            this._onEnemyKilled();
            this.sfx('enemyDie');
            this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, PALETTE.appleOrange, 16, 200);
            if (e.hasGold) {
              this.golds.push({
                x: d.tx * TILE_SIZE + 6,
                y: (d.ty - 1) * TILE_SIZE + 10,
                w: 20, h: 18, collected: false, bob: 0,
              });
            }
          }
        }

        if (rectOverlap(this.player, brickRect)) {
          this.player.y = d.ty * TILE_SIZE - this.player.h - 1;
          this.player.vy = -120;
        }
      }
    }
  }

  _updateVoltaCoils(dt) {
    for (const c of this.voltaCoils) {
      const prevActive = c.phase >= 2.35;
      c.phase = (c.phase + dt) % 3.2;
      const nowActive = c.phase >= 2.35;
      if (!prevActive && nowActive) this.sfx('volta');
      if (nowActive) {
        const zapRect = {
          x: c.tx * TILE_SIZE - 14,
          y: c.ty * TILE_SIZE - 10,
          w: TILE_SIZE + 28,
          h: TILE_SIZE + 14,
        };
        if (rectOverlap(this.player, zapRect)) {
          this._damagePlayer(2, c.tx * TILE_SIZE + 16);
        }
      }
    }
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    const speedMult = this.hasUpgrade('volta_boots') ? 1.18 : 1.0;
    const jumpMult = this.hasUpgrade('volta_boots') ? 1.08 : 1.0;
    const slideCdBase = this.hasUpgrade('volta_boots') ? 0.28 : PHYSICS.SLIDE_COOLDOWN;
    const boloRegen = PHYSICS.BOLO_REGEN_RATE * (this.hasUpgrade('bolo_overdrive') ? 1.5 : 1.0);
    const boloCost = this.hasUpgrade('bolo_overdrive') ? 15 : PHYSICS.BOLO_COST;
    const chargeNeed = this.hasUpgrade('quick_charge') ? PHYSICS.CHARGE_TIME * 0.55 : PHYSICS.CHARGE_TIME;

    p.animTime += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    p.slideCd = Math.max(0, p.slideCd - dt);
    p.shootAnim = Math.max(0, p.shootAnim - dt);
    p.digAnim = Math.max(0, p.digAnim - dt);
    p.boloEnergy = Math.min(PHYSICS.BOLO_MAX_ENERGY, p.boloEnergy + boloRegen * dt);

    if (input.jumpPressed) p.jumpBuf = 0.12;
    else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);
    const footTy = Math.floor((p.y + p.h + 1) / TILE_SIZE);

    const onLadderTile = this.tileAt(tx, ty) === TILE.LADDER;
    const ladderBelow = this.tileAt(tx, footTy) === TILE.LADDER;
    const onRopeTile = this.tileAt(tx, Math.floor((p.y + 8) / TILE_SIZE)) === TILE.ROPE;

    if (input.slidePressed && p.slideCd <= 0 && p.onGround && !p.onLadder && !p.onRope) {
      p.sliding = PHYSICS.SLIDE_DURATION;
      p.slideCd = slideCdBase;
      p.vx = p.facing * PHYSICS.SLIDE_SPEED * speedMult;
      p.invuln = Math.max(p.invuln, 0.24);
      this.sfx('slide');
      this.spawnParticles(p.x + p.w / 2, p.y + p.h, PALETTE.megaCyan, 7, 110);
    }

    if (!p.sliding && (input.up || input.down)) {
      if ((input.up && onLadderTile) || (input.down && (onLadderTile || ladderBelow))) {
        p.onLadder = true;
        p.onRope = false;
        p.vy = 0;
        p.somersault = 0;
        const targetX = tx * TILE_SIZE + (TILE_SIZE - p.w) / 2;
        p.x += (targetX - p.x) * Math.min(1, dt * 16);
      }
    }

    if (!p.onLadder && onRopeTile && !input.down && p.vy >= 0) {
      p.onRope = true;
      p.vy = 0;
      p.somersault = 0;
      const ropeTy = Math.floor((p.y + 8) / TILE_SIZE);
      p.y = ropeTy * TILE_SIZE + 4;
    }

    if (p.sliding > 0) {
      p.sliding -= dt;
      p.vx = p.facing * PHYSICS.SLIDE_SPEED * speedMult;
      p.vy = Math.min(PHYSICS.MAX_FALL, p.vy + PHYSICS.GRAVITY * dt);
    } else if (p.onLadder) {
      let mx = 0;
      if (input.left) { mx = -1; p.facing = -1; }
      if (input.right) { mx = 1; p.facing = 1; }
      p.vx = mx * PHYSICS.CLIMB_SPEED * 0.8 * speedMult;

      if (input.up) p.vy = -PHYSICS.CLIMB_SPEED * speedMult;
      else if (input.down) p.vy = PHYSICS.CLIMB_SPEED * speedMult;
      else p.vy = 0;

      if (!onLadderTile && !(input.down && ladderBelow)) {
        p.onLadder = false;
      }
      if (p.jumpBuf > 0) {
        p.onLadder = false;
        p.vy = PHYSICS.JUMP_VEL * 0.92 * jumpMult;
        p.jumpBuf = 0;
        p.somersault = 1;
        this.sfx('jump');
      }
    } else if (p.onRope) {
      let mx = 0;
      if (input.left) { mx = -1; p.facing = -1; }
      if (input.right) { mx = 1; p.facing = 1; }
      p.vx = mx * PHYSICS.ROPE_SPEED * speedMult;
      p.vy = 0;

      if (!onRopeTile || input.down) {
        p.onRope = false;
        if (input.down) p.y += 10;
      } else if (p.jumpBuf > 0) {
        p.onRope = false;
        p.vy = PHYSICS.JUMP_VEL * 0.85 * jumpMult;
        p.jumpBuf = 0;
        p.somersault = 1;
        this.sfx('jump');
      }
    } else {
      let mx = 0;
      if (input.left) { mx = -1; p.facing = -1; }
      if (input.right) { mx = 1; p.facing = 1; }
      p.vx = mx * PHYSICS.MOVE_SPEED * speedMult;

      if (p.onGround) {
        p.coyote = 0.1;
        p.somersault = 0;
      } else {
        p.coyote = Math.max(0, p.coyote - dt);
      }

      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = PHYSICS.JUMP_VEL * jumpMult;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.somersault = 1;
        this.sfx('jump');
        this.spawnParticles(p.x + p.w / 2, p.y + p.h, PALETTE.white, 5, 80);
      }

      if (!input.jump && p.vy < -180) {
        p.vy *= 0.86;
      }

      p.vy = Math.min(PHYSICS.MAX_FALL, p.vy + PHYSICS.GRAVITY * dt);
    }

    p.x += p.vx * dt;
    this._resolveX(p);

    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.onGround = false;
    this._resolveY(p, prevBottom, input.down);

    if (p.vy >= 0) {
      for (const e of this.enemies) {
        if (!e.alive || e.trapped <= 0) continue;
        if (
          p.x + p.w > e.x + 2 &&
          p.x < e.x + e.w - 2 &&
          prevBottom <= e.y + 6 &&
          p.y + p.h >= e.y
        ) {
          p.y = e.y - p.h;
          p.vy = 0;
          p.onGround = true;
        }
      }
    }

    const footTileL = this.tileAt(Math.floor((p.x + 4) / TILE_SIZE), Math.floor((p.y + p.h - 2) / TILE_SIZE));
    const footTileR = this.tileAt(Math.floor((p.x + p.w - 4) / TILE_SIZE), Math.floor((p.y + p.h - 2) / TILE_SIZE));
    if (footTileL === TILE.LAVA || footTileR === TILE.LAVA) {
      this._damagePlayer(3, p.x + p.w / 2);
      p.vy = -380;
    }

    // 1. Mega Buster
    if (input.shootPressed) {
      this._fireBuster(false);
      p.charging = true;
      p.chargeTime = 0;
    } else if (input.shoot && p.charging) {
      p.chargeTime += dt;
    } else if (!input.shoot && p.charging) {
      if (p.chargeTime >= chargeNeed) {
        this._fireBuster(true);
      }
      p.charging = false;
      p.chargeTime = 0;
    }

    // 2. Conan Boomerang Axe
    if (input.axePressed) {
      const activeAxes = this.projectiles.filter((pr) => pr.type === 'axe').length;
      const maxAxes = (this.hasUpgrade('twin_axes') ? 2 : 1) + (p.shieldTimer > 0 ? 1 : 0);
      if (activeAxes < maxAxes) {
        this.projectiles.push({
          type: 'axe',
          friendly: true,
          x: p.x + p.w / 2 - 9,
          y: p.y + 5,
          w: 18,
          h: 18,
          vx: p.facing * 390,
          vy: -30,
          dmg: this.hasUpgrade('twin_axes') ? 3 : 2,
          timer: 0,
          returning: false,
          spin: 0,
          hitIds: new Set(),
        });
        p.shootAnim = 0.2;
        this.sfx('axeThrow');
      }
    }

    // 3. Lode Runner Dig
    if (input.digLeftPressed) this._tryDig(-1);
    else if (input.digRightPressed) this._tryDig(1);

    // 4. Bolo Mortar
    if (input.boloPressed && p.boloEnergy >= boloCost) {
      p.boloEnergy -= boloCost;
      this.projectiles.push({
        type: 'bolo_shell',
        friendly: true,
        x: p.x + (p.facing > 0 ? p.w : -12),
        y: p.y + 6,
        w: 12,
        h: 12,
        vx: p.facing * 315,
        vy: -190,
        dmg: this.hasUpgrade('bolo_overdrive') ? 7 : 5,
        life: 2.0,
      });
      p.shootAnim = 0.25;
      this.shake = Math.max(this.shake, 5);
      this.sfx('boloCannon');
      this.spawnParticles(p.x + (p.facing > 0 ? p.w : 0), p.y + 12, PALETTE.appleOrange, 8, 140);
    }
  }

  _fireBuster(charged) {
    const p = this.player;
    const maxShots = this.hasUpgrade('twin_buster') ? 6 : PHYSICS.MAX_BUSTER_SHOTS;
    const activeLemons = this.projectiles.filter((pr) => pr.type === 'buster').length;
    if (!charged && activeLemons >= maxShots) return;

    if (!charged && this.hasUpgrade('twin_buster')) {
      for (const vy of [-28, 28]) {
        this.projectiles.push({
          type: 'buster',
          friendly: true,
          x: p.x + (p.facing > 0 ? p.w - 2 : -14),
          y: p.y + 10,
          w: 10,
          h: 6,
          vx: p.facing * 440,
          vy,
          dmg: 1,
          pierce: 1,
          life: 1.4,
        });
      }
    } else {
      const chargeDmg = this.hasUpgrade('quick_charge') ? 6 : 4;
      this.projectiles.push({
        type: charged ? 'charge' : 'buster',
        friendly: true,
        x: p.x + (p.facing > 0 ? p.w - 2 : -14),
        y: p.y + (charged ? 4 : 10),
        w: charged ? 24 : 10,
        h: charged ? 16 : 6,
        vx: p.facing * (charged ? 500 : 425),
        vy: 0,
        dmg: charged ? chargeDmg : 1,
        pierce: charged ? 4 : 1,
        life: 1.4,
      });
    }

    p.shootAnim = 0.18;
    if (charged) {
      this.shake = Math.max(this.shake, 6);
      this.sfx('chargeShot');
      this.spawnParticles(p.x + p.w / 2, p.y + 12, PALETTE.megaCyan, 12, 180);
    } else {
      this.sfx('buster');
    }
  }

  _tryDig(dir) {
    const p = this.player;
    p.facing = dir;
    const cx = p.x + p.w / 2;
    const tx = Math.floor(cx / TILE_SIZE) + dir;
    const footTy = Math.floor((p.y + p.h + 2) / TILE_SIZE);

    if (tx <= 0 || tx >= GRID_COLS - 1 || footTy >= GRID_ROWS - 1) return;
    if (this.tileAt(tx, footTy) !== TILE.BRICK) return;
    if (this.isSolid(tx, footTy - 1)) return;

    const regen = PHYSICS.BRICK_REGEN_TIME + (this.hasUpgrade('lode_master') ? 2.5 : 0);
    this.grid[footTy][tx] = TILE.EMPTY;
    this.dugBricks.push({ tx, ty: footTy, timer: regen });
    p.digAnim = 0.22;
    this.sfx('dig');
    this.spawnParticles(tx * TILE_SIZE + 16, footTy * TILE_SIZE + 12, PALETTE.brickHi, 12, 150);
  }

  _resolveX(ent) {
    const topTy = Math.floor((ent.y + 2) / TILE_SIZE);
    const botTy = Math.floor((ent.y + ent.h - 2) / TILE_SIZE);
    if (ent.vx > 0) {
      const rightTx = Math.floor((ent.x + ent.w) / TILE_SIZE);
      for (let ty = topTy; ty <= botTy; ty++) {
        if (this.isSolid(rightTx, ty)) {
          ent.x = rightTx * TILE_SIZE - ent.w - 0.01;
          ent.vx = 0;
          return true;
        }
      }
    } else if (ent.vx < 0) {
      const leftTx = Math.floor(ent.x / TILE_SIZE);
      for (let ty = topTy; ty <= botTy; ty++) {
        if (this.isSolid(leftTx, ty)) {
          ent.x = (leftTx + 1) * TILE_SIZE + 0.01;
          ent.vx = 0;
          return true;
        }
      }
    }
    return false;
  }

  _resolveY(ent, prevBottom, dropThroughLadder = false) {
    const leftTx = Math.floor((ent.x + 2) / TILE_SIZE);
    const rightTx = Math.floor((ent.x + ent.w - 2) / TILE_SIZE);

    if (ent.vy >= 0) {
      const botTy = Math.floor((ent.y + ent.h) / TILE_SIZE);
      for (let tx = leftTx; tx <= rightTx; tx++) {
        const t = this.tileAt(tx, botTy);
        const solid = t === TILE.BRICK || t === TILE.STONE;
        const ladderTop =
          !dropThroughLadder &&
          t === TILE.LADDER &&
          this.tileAt(tx, botTy - 1) !== TILE.LADDER &&
          prevBottom <= botTy * TILE_SIZE + 6;
        if (solid || ladderTop) {
          ent.y = botTy * TILE_SIZE - ent.h;
          ent.vy = 0;
          ent.onGround = true;
          return true;
        }
      }
    } else {
      const topTy = Math.floor(ent.y / TILE_SIZE);
      for (let tx = leftTx; tx <= rightTx; tx++) {
        if (this.isSolid(tx, topTy)) {
          ent.y = (topTy + 1) * TILE_SIZE + 0.01;
          ent.vy = 0;
          return true;
        }
      }
    }
    return false;
  }

  _updateEnemies(dt) {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.anim += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.type === 'guard') this._updateGuard(e, dt, pcx, pcy);
      else if (e.type === 'bat') this._updateBat(e, dt);
      else if (e.type === 'tank') this._updateTank(e, dt, pcx, pcy);
      else if (e.type === 'pillbox') this._updatePillbox(e, dt, pcx, pcy);
      else if (e.type === 'boss') this._updateBoss(e, dt, pcx, pcy);

      if (e.trapped <= 0 && rectOverlap(p, e)) {
        this._damagePlayer(e.type === 'boss' ? 3 : 2, e.x + e.w / 2);
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);
  }

  _updateGuard(e, dt, pcx, pcy) {
    if (e.trapped > 0) {
      e.trapped -= dt;
      if (e.trapped <= 0) {
        e.y = (e.trapTy - 1) * TILE_SIZE + 4;
        e.x = e.trapTx * TILE_SIZE + 5;
        e.trapTx = -1;
        e.trapTy = -1;
      }
      return;
    }

    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const tx = Math.floor(ecx / TILE_SIZE);
    const ty = Math.floor(ecy / TILE_SIZE);

    if (this.isDugAt(tx, ty)) {
      e.trapped = 3.6 + (this.hasUpgrade('lode_master') ? 1.5 : 0);
      e.trapTx = tx;
      e.trapTy = ty;
      e.x = tx * TILE_SIZE + 5;
      e.y = ty * TILE_SIZE + 4;
      e.vx = 0;
      e.vy = 0;
      this.addScore(50, e.x, e.y - 8, 'TRAPPED', PALETTE.appleGreen, true);
      if (e.hasGold) {
        e.hasGold = false;
        this.golds.push({
          x: tx * TILE_SIZE + 6,
          y: (ty - 1) * TILE_SIZE + 10,
          w: 20, h: 18, collected: false, bob: 0,
        });
      }
      return;
    }

    const spd = 92 + (this.loop - 1) * 14;
    const onLadder = this.tileAt(tx, ty) === TILE.LADDER;
    const ladderBelow = this.tileAt(tx, ty + 1) === TILE.LADDER;

    if (onLadder && Math.abs(pcy - ecy) > 22) {
      e.vx = 0;
      e.vy = pcy < ecy ? -spd : spd;
      e.x += (tx * TILE_SIZE + 5 - e.x) * Math.min(1, dt * 10);
    } else if (ladderBelow && pcy > ecy + 24) {
      e.vx = 0;
      e.vy = spd;
    } else {
      const dir = pcx < ecx ? -1 : 1;
      e.facing = dir;
      e.vx = dir * spd;
      e.vy = Math.min(PHYSICS.MAX_FALL, e.vy + PHYSICS.GRAVITY * dt);
    }

    e.x += e.vx * dt;
    this._resolveX(e);
    const prevBot = e.y + e.h;
    e.y += e.vy * dt;
    this._resolveY(e, prevBot, pcy > ecy + 24);

    if (!e.hasGold) {
      for (const g of this.golds) {
        if (!g.collected && rectOverlap(e, g)) {
          g.collected = true;
          e.hasGold = true;
          break;
        }
      }
    }
  }

  _updateBat(e, dt) {
    e.x += e.vx * dt;
    e.y = e.baseY + Math.sin(e.anim * 3.8) * 26;
    const hitWall = this._resolveX(e);
    if (hitWall) {
      e.facing = -e.facing;
      e.vx = e.facing * (85 + (this.loop - 1) * 15);
    }
  }

  _updateTank(e, dt, pcx, pcy) {
    if (e.trapped > 0) {
      e.trapped -= dt;
      if (e.trapped <= 0) {
        e.y = (e.trapTy - 1) * TILE_SIZE + 6;
        e.trapTx = -1;
        e.trapTy = -1;
      }
      return;
    }

    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const tx = Math.floor(ecx / TILE_SIZE);
    const ty = Math.floor(ecy / TILE_SIZE);

    if (this.isDugAt(tx, ty)) {
      e.trapped = 3.2;
      e.trapTx = tx;
      e.trapTy = ty;
      e.x = tx * TILE_SIZE + 2;
      e.y = ty * TILE_SIZE + 6;
      e.vx = 0;
      e.vy = 0;
      this.addScore(50, e.x, e.y - 8, 'STUCK', PALETTE.appleGreen, true);
      return;
    }

    e.vx = e.facing * (58 + (this.loop - 1) * 10);
    e.vy = Math.min(PHYSICS.MAX_FALL, e.vy + PHYSICS.GRAVITY * dt);
    e.x += e.vx * dt;
    const hitWall = this._resolveX(e);
    const prevBot = e.y + e.h;
    e.y += e.vy * dt;
    this._resolveY(e, prevBot, false);

    const aheadTx = Math.floor((ecx + e.facing * 18) / TILE_SIZE);
    const belowTy = Math.floor((e.y + e.h + 4) / TILE_SIZE);
    const isLedge = !this.isSolid(aheadTx, belowTy) && !this.isDugAt(aheadTx, belowTy);
    if (hitWall || (e.onGround && isLedge)) e.facing = -e.facing;

    e.turretAngle = Math.atan2(pcy - ecy, pcx - ecx);
    e.fireCd -= dt;
    const dist = Math.hypot(pcx - ecx, pcy - ecy);
    if (e.fireCd <= 0 && dist < 340) {
      e.fireCd = Math.max(1.2, 2.3 - (this.loop - 1) * 0.25);
      this.projectiles.push({
        type: 'enemy_shell',
        friendly: false,
        x: ecx + Math.cos(e.turretAngle) * 14 - 4,
        y: ecy + Math.sin(e.turretAngle) * 14 - 4,
        w: 8, h: 8,
        vx: Math.cos(e.turretAngle) * 215,
        vy: Math.sin(e.turretAngle) * 215,
        dmg: 2, life: 2.2,
      });
      this.sfx('turretFire');
    }
  }

  _updatePillbox(e, dt, pcx, pcy) {
    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    e.turretAngle = Math.atan2(pcy - ecy, pcx - ecx);
    const dist = Math.hypot(pcx - ecx, pcy - ecy);

    e.fireCd -= dt;
    e.telegraph = e.fireCd < 0.45 && dist < 360 ? 1 - e.fireCd / 0.45 : 0;

    if (e.fireCd <= 0 && dist < 360) {
      e.fireCd = Math.max(1.1, 2.1 - (this.loop - 1) * 0.22);
      e.telegraph = 0;
      this.projectiles.push({
        type: 'enemy_shell',
        friendly: false,
        x: ecx + Math.cos(e.turretAngle) * 15 - 4,
        y: ecy + Math.sin(e.turretAngle) * 15 - 4,
        w: 8, h: 8,
        vx: Math.cos(e.turretAngle) * 235,
        vy: Math.sin(e.turretAngle) * 235,
        dmg: 2, life: 2.4,
      });
      this.sfx('turretFire');
    }
  }

  _updateBoss(b, dt, pcx, pcy) {
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const phase2 = b.hp <= b.maxHp * 0.5;
    const speed = (phase2 ? 105 : 70) + (this.loop - 1) * 18;

    b.x += b.vx * dt;
    b.y = 6 * TILE_SIZE - 12 + Math.sin(b.anim * (phase2 ? 3.2 : 2.0)) * 26;
    if (b.x < TILE_SIZE * 6) {
      b.x = TILE_SIZE * 6;
      b.vx = speed;
    } else if (b.x + b.w > TILE_SIZE * 19) {
      b.x = TILE_SIZE * 19 - b.w;
      b.vx = -speed;
    }

    b.turretAngle = Math.atan2(pcy - bcy, pcx - bcx);

    b.attackCd -= dt;
    if (b.attackCd <= 0) {
      b.attackCd = Math.max(0.85, (phase2 ? 1.35 : 1.9) - (this.loop - 1) * 0.15);
      b.patternIdx = (b.patternIdx + 1) % 3;

      if (b.patternIdx === 0) {
        for (const offset of [-0.28, 0, 0.28]) {
          const ang = b.turretAngle + offset;
          this.projectiles.push({
            type: 'enemy_shell', friendly: false,
            x: bcx - 5, y: bcy - 5, w: 10, h: 10,
            vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230,
            dmg: 2, life: 2.8,
          });
        }
        this.sfx('turretFire');
      } else if (b.patternIdx === 1) {
        for (const vx of [-180, -70, 70, 180]) {
          this.projectiles.push({
            type: 'enemy_shell', friendly: false,
            x: bcx - 5, y: b.y + b.h - 6, w: 10, h: 10,
            vx, vy: 150, dmg: 2, life: 2.5,
          });
        }
        this.sfx('volta');
      } else {
        const ang = b.turretAngle;
        this.projectiles.push({
          type: 'enemy_shell', friendly: false,
          x: bcx - 6, y: bcy - 6, w: 12, h: 12,
          vx: Math.cos(ang) * 270, vy: Math.sin(ang) * 270,
          dmg: 3, life: 2.8,
        });
        this.sfx('boloCannon');
      }
    }

    b.summonCd -= dt;
    const guardCount = this.enemies.filter((e) => e.type === 'guard').length;
    if (b.summonCd <= 0 && guardCount < 2) {
      b.summonCd = phase2 ? 7.5 : 10.5;
      this.enemies.push(this._makeGuard(bcx - 11, b.y + b.h));
      this.spawnParticles(bcx, b.y + b.h, PALETTE.appleViolet, 10, 130);
    }
  }

  _updateProjectiles(dt) {
    const p = this.player;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];

      if (pr.type === 'axe') {
        pr.timer += dt;
        pr.spin += dt * 20;
        if (!pr.returning) {
          pr.vx *= Math.pow(0.25, dt);
          pr.vy += 90 * dt;
          if (pr.timer > 0.42) {
            pr.returning = true;
            pr.hitIds.clear();
          }
        } else {
          const dx = p.x + p.w / 2 - (pr.x + pr.w / 2);
          const dy = p.y + p.h / 2 - (pr.y + pr.h / 2);
          const d = Math.max(1, Math.hypot(dx, dy));
          pr.vx = (dx / d) * 425;
          pr.vy = (dy / d) * 425;
          if (d < 22 || pr.timer > 2.2) {
            this.projectiles.splice(i, 1);
            continue;
          }
        }
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      } else if (pr.type === 'bolo_shell') {
        pr.life -= dt;
        pr.vy += PHYSICS.GRAVITY * 0.62 * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      } else {
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      }

      if (pr.life !== undefined && pr.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.type !== 'axe') {
        const tx = Math.floor((pr.x + pr.w / 2) / TILE_SIZE);
        const ty = Math.floor((pr.y + pr.h / 2) / TILE_SIZE);
        if (this.isSolid(tx, ty)) {
          if (pr.type === 'bolo_shell') {
            this._explodeBoloShell(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.dmg);
          } else {
            this.spawnParticles(pr.x, pr.y, pr.friendly ? PALETTE.megaCyan : PALETTE.appleOrange, 5, 90);
          }
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (pr.friendly) {
        let consumed = false;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (pr.type === 'axe' && pr.hitIds.has(e)) continue;
          if (!rectOverlap(pr, e)) continue;

          if (pr.type === 'bolo_shell') {
            this._explodeBoloShell(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.dmg);
            consumed = true;
            break;
          }

          if (e.type === 'tank' && pr.type === 'buster' && Math.sign(pr.vx) === -e.facing) {
            this.spawnParticles(pr.x, pr.y, PALETTE.white, 6, 130);
            this.addPopup(e.x, e.y - 8, 'ARMOR!', PALETTE.steel);
            consumed = true;
            break;
          }

          if (pr.type === 'axe' && pr.returning) {
            this.unlockFeat('wall_sniper');
          }

          this._damageEnemy(e, pr.dmg);
          if (pr.type === 'axe') {
            pr.hitIds.add(e);
          } else {
            pr.pierce = (pr.pierce || 1) - 1;
            if (pr.pierce <= 0) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) this.projectiles.splice(i, 1);
      } else {
        if (rectOverlap(pr, p)) {
          this._damagePlayer(pr.dmg, pr.x + pr.w / 2);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  _explodeBoloShell(x, y, dmg = 5) {
    const overdrive = this.hasUpgrade('bolo_overdrive');
    const brickRad = overdrive ? 64 : 46;
    const dmgRad = overdrive ? 84 : 64;

    this.shake = Math.max(this.shake, 9);
    this.sfx('boloCannon');
    this.spawnParticles(x, y, PALETTE.appleOrange, 22, 240);
    this.spawnParticles(x, y, PALETTE.goldBright, 12, 170);

    const ctx = Math.floor(x / TILE_SIZE);
    const cty = Math.floor(y / TILE_SIZE);
    let blasted = 0;
    const span = overdrive ? 2 : 1;
    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        const tx = ctx + dx;
        const ty = cty + dy;
        if (tx <= 0 || tx >= GRID_COLS - 1 || ty <= 0 || ty >= GRID_ROWS - 1) continue;
        if (this.tileAt(tx, ty) === TILE.BRICK) {
          const dist = Math.hypot(tx * TILE_SIZE + 16 - x, ty * TILE_SIZE + 16 - y);
          if (dist <= brickRad) {
            this.grid[ty][tx] = TILE.EMPTY;
            this.dugBricks.push({ tx, ty, timer: PHYSICS.BRICK_REGEN_TIME + 1.5 });
            blasted++;
          }
        }
      }
    }
    if (blasted >= 3) this.unlockFeat('demolitionist');

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
      if (dist <= dmgRad) {
        this._damageEnemy(e, dmg);
      }
    }
  }

  _onEnemyKilled() {
    this.killsThisRun++;
    if (this.hasUpgrade('vampiric_core') && this.killsThisRun % 4 === 0 && this.player) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.player.boloEnergy = Math.min(PHYSICS.BOLO_MAX_ENERGY, this.player.boloEnergy + 30);
      this.addPopup(this.player.x, this.player.y - 10, 'SIPHON +1HP', '#ff48a8');
    }
  }

  _damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.hitFlash = 0.14;
    if (e.hp <= 0) {
      e.alive = false;
      const pts =
        e.type === 'boss' ? 2500 : e.type === 'tank' ? 300 : e.type === 'pillbox' ? 250 : 150;
      this.addScore(pts, e.x, e.y - 6, '', PALETTE.goldBright, true);
      this._onEnemyKilled();
      if (e.type === 'boss') this.unlockFeat('volta_slayer');

      this.shake = Math.max(this.shake, e.type === 'boss' ? 14 : 5);
      this.hitstop = e.type === 'boss' ? 0.12 : 0.03;
      this.sfx('enemyDie');
      this.spawnParticles(
        e.x + e.w / 2, e.y + e.h / 2,
        e.type === 'boss' ? PALETTE.appleViolet : PALETTE.appleOrange,
        e.type === 'boss' ? 40 : 16,
        e.type === 'boss' ? 280 : 190
      );

      if (e.hasGold) {
        this.golds.push({
          x: e.x, y: e.y, w: 20, h: 18, collected: false, bob: 0,
        });
      }
    } else {
      this.sfx('enemyHit');
      this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, PALETTE.white, 6, 120);
    }
  }

  _damagePlayer(dmg, srcX) {
    const p = this.player;
    if (p.invuln > 0) return;

    const actual = p.shieldTimer > 0 ? Math.max(1, Math.ceil(dmg / 2)) : dmg;
    p.hp -= actual;
    this.chamberDamage += actual;
    this.combo = 0;
    this.comboTimer = 0;
    p.invuln = this.hasUpgrade('titan_plating') ? 1.45 : 1.05;
    p.onLadder = false;
    p.onRope = false;
    p.vx = (p.x + p.w / 2 < srcX ? -1 : 1) * 180;
    p.vy = -220;
    this.shake = Math.max(this.shake, 8);
    this.hitstop = 0.05;
    this.sfx('playerHit');
    this.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, PALETTE.crimson, 14, 180);

    if (p.hp <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.save.recordScore(this.score, this.loop);
        this.state = 'game_over';
        this.sfx('gameOver');
      } else {
        this.loadLevel(this.levelIndex, true);
      }
    }
  }

  _updatePickups(dt) {
    const p = this.player;
    for (const g of this.golds) {
      if (g.collected) continue;
      g.bob += dt * 4;
      if (rectOverlap(p, g)) {
        g.collected = true;
        this.addScore(100, g.x, g.y - 6, 'GOLD', PALETTE.goldBright, true);
        p.boloEnergy = Math.min(PHYSICS.BOLO_MAX_ENERGY, p.boloEnergy + 25);
        this.sfx('gold');
        this.spawnParticles(g.x + 10, g.y + 9, PALETTE.gold, 10, 140);
      }
    }

    for (const k of this.powerups) {
      if (k.collected) continue;
      k.bob += dt * 3.5;
      if (rectOverlap(p, k)) {
        k.collected = true;
        p.hp = Math.min(p.maxHp, p.hp + 4);
        p.boloEnergy = PHYSICS.BOLO_MAX_ENERGY;
        p.shieldTimer = 8.0;
        this.addScore(150, k.x - 10, k.y - 8, 'BOLO CORE', PALETTE.appleCyan, false);
        this.sfx('powerup');
        this.spawnParticles(k.x + 10, k.y + 10, PALETTE.appleCyan, 16, 170);
      }
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 320 * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      pop.y -= 28 * dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  remainingGold() {
    const onFloor = this.golds.filter((g) => !g.collected).length;
    const heldByGuards = this.enemies.filter((e) => e.alive && e.hasGold).length;
    return onFloor + heldByGuards;
  }

  _checkPortal() {
    const bossAlive = this.boss && this.boss.alive;
    const ready = this.remainingGold() === 0 && !bossAlive;
    if (ready && !this.portalOpen) {
      this.portalOpen = true;
      this.sfx('portalOpen');
      if (this.portal) {
        this.spawnParticles(this.portal.x + 16, this.portal.y + 16, PALETTE.appleGreen, 24, 200);
        this.addPopup(this.portal.x - 24, this.portal.y - 6, 'PORTAL OPEN!', PALETTE.appleGreen);
      }
    }

    if (this.portalOpen && this.portal && rectOverlap(this.player, this.portal)) {
      const rank = computeChamberRank(this.chamberTime, this.chamberDamage, this.maxCombo);
      const flawless = this.chamberDamage === 0;
      if (flawless) this.unlockFeat('untouchable');

      const timeBonus = Math.max(0, Math.round((85 - this.chamberTime) * 10));
      const flawlessBonus = flawless ? 500 : 0;
      const clearBonus = 500 + timeBonus + flawlessBonus;
      this.score += clearBonus * this.loop;
      this.save.recordScore(this.score, this.loop);
      this.save.recordRank(this.levelIndex, rank);

      this.lastClearSummary = {
        chamberName: this.levelDef.name,
        rank,
        timeSec: this.chamberTime,
        flawless,
        maxCombo: this.maxCombo,
        bonus: clearBonus * this.loop,
      };

      this.sfx('levelWin');

      if (this.levelIndex + 1 < LEVELS.length) {
        this.upgradeChoices = rollUpgradeChoices(this.upgrades, 3);
        this.state = 'upgrade_pick';
      } else {
        this.state = 'victory';
      }
    }
  }
}
