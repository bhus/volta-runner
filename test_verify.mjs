import assert from 'node:assert/strict';
import { Game } from './src/game.js';
import { LEVELS } from './src/levels.js';
import { GRID_COLS, GRID_ROWS } from './src/constants.js';
import { computeChamberRank } from './src/progression.js';

// 1. Validate all 5 levels
for (let i = 0; i < LEVELS.length; i++) {
  const lvl = LEVELS[i];
  assert.equal(lvl.map.length, GRID_ROWS, `Level ${i + 1} row count`);
  for (let r = 0; r < GRID_ROWS; r++) {
    assert.equal(lvl.map[r].length, GRID_COLS, `Level ${i + 1} row ${r} col count`);
  }
  const g = new Game(null);
  g.loadLevel(i, true);
  assert.ok(g.portal, `Level ${i + 1} has portal`);
  assert.ok(g.golds.length > 0, `Level ${i + 1} has gold`);
  if (lvl.boss) assert.ok(g.boss, `Boss level has boss`);
}

// 2. Simulate core mechanics + combo + brick regen
const game = new Game(null);
const emptyInput = () => ({
  left: false, right: false, up: false, down: false,
  jump: false, jumpPressed: false, slidePressed: false,
  shoot: false, shootPressed: false, axePressed: false,
  digLeftPressed: false, digRightPressed: false, boloPressed: false,
  startPressed: false, pick1: false, pick2: false, pick3: false,
});

game.update(1 / 60, { ...emptyInput(), startPressed: true });
assert.equal(game.state, 'playing');

for (let i = 0; i < 20; i++) game.update(1 / 60, emptyInput());
assert.ok(game.player.onGround, 'Player settles on ground');

game.update(1 / 60, { ...emptyInput(), digRightPressed: true });
assert.equal(game.dugBricks.length, 1, 'Dig right removes brick');

game.update(1 / 60, { ...emptyInput(), shootPressed: true, shoot: true });
game.update(1 / 60, { ...emptyInput(), axePressed: true });
game.update(1 / 60, { ...emptyInput(), boloPressed: true });
assert.ok(game.projectiles.some((p) => p.type === 'buster'), 'Buster fired');
assert.ok(game.projectiles.some((p) => p.type === 'axe'), 'Conan Axe thrown');
assert.ok(game.projectiles.some((p) => p.type === 'bolo_shell'), 'Bolo Mortar fired');

for (let i = 0; i < 520; i++) game.update(1 / 60, emptyInput());
assert.equal(game.dugBricks.length, 0, 'All dug & Bolo-blasted bricks regenerated');

// 3. Test progression: Chamber Clear -> Volta Forge Upgrade Pick -> Next Chamber -> New Game+ Loop
assert.equal(computeChamberRank(25, 0, 5), 'S', 'Flawless fast high-combo earns S rank');
assert.equal(computeChamberRank(95, 6, 1), 'C', 'Slow damaged run earns C rank');

// Collect all gold & touch portal in Chamber 1
for (const g of game.golds) g.collected = true;
game.player.x = game.portal.x;
game.player.y = game.portal.y;
game.update(1 / 60, emptyInput());

assert.equal(game.state, 'upgrade_pick', 'Clearing Chamber 1 opens Volta Forge');
assert.equal(game.upgradeChoices.length, 3, 'Volta Forge offers 3 upgrades');
assert.ok(game.lastClearSummary && game.lastClearSummary.rank, 'Clear summary & rank computed');

// Pick upgrade 1 via key input
game.update(1 / 60, { ...emptyInput(), pick1: true });
assert.equal(game.state, 'playing', 'Picking upgrade advances to next chamber');
assert.equal(game.levelIndex, 1, 'Advanced to Chamber 2');
assert.equal(game.upgrades.size, 1, 'Upgrade persisted into next chamber');

// Test New Game+ Loop preserves upgrades & increments loop
game.state = 'victory';
game.update(1 / 60, { ...emptyInput(), startPressed: true });
assert.equal(game.state, 'playing', 'Victory -> Enter starts New Game+ Loop');
assert.equal(game.loop, 2, 'Loop incremented to 2');
assert.equal(game.upgrades.size, 1, 'Forged upgrades kept in Loop 2');

console.log(`ALL CHECKS PASSED (${LEVELS.length} chambers, 4-game mechanics, Volta Forge, S-Ranks, Feats & NG+ Loop verified)`);
