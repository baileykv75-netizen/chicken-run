// Phase 4I: one chick at the start; a flock grows through rescue and simple hatching.
// No individual careers, inventory, new currencies, or new capture rules.
const PHASE4I = Object.freeze({
  startingChicks: 1,
  maxChicks: 10,
  firstChickProtection: 40, // A small grace period while the player learns to escort.
  firstHatchLevel: 3,
  hatchEveryLevels: 3,
  newChickProtection: 3,
});
let phase4i = { nextHatchLevel: PHASE4I.firstHatchLevel, hatched: 0 };

function phase4iLivingCount() {
  return chicks.reduce((count, chick) => count + (chick.lost ? 0 : 1), 0);
}
function phase4iHatch() {
  if (!player || phase4iLivingCount() >= PHASE4I.maxChicks) return false;
  // Reuse the existing 4H chick factory to keep identity, physics and
  // existing awakening/cultivation interactions consistent.
  const chick = phase4hCreateChick();
  chick.protectedFor = Math.max(chick.protectedFor || 0, PHASE4I.newChickProtection);
  chick.phase4iHatched = true;
  chicks.push(chick);
  phase4i.hatched += 1;
  addParticles(chick.x, chick.y, '✿', 6);
  playTone(720, 0.12, 0.035, 'sine');
  phase4hNotify('一只小鸡破壳而出！鸡群 ' + phase4iLivingCount() + '/' + PHASE4I.maxChicks, 2.8);
  return true;
}

const phase4iResetBase = resetGame;
resetGame = function resetPhase4iGame() {
  phase4i = { nextHatchLevel: PHASE4I.firstHatchLevel, hatched: 0 };
  phase4iResetBase();
  // Preserve the original chick model but start with only one follower.
  chicks = chicks.slice(0, PHASE4I.startingChicks);
  const first = chicks[0];
  if (first) {
    first.x = clamp(player.x + 36, 14, world.width - 14);
    first.y = clamp(player.y + 28, 14, world.height - 14);
    first.protectedFor = PHASE4I.firstChickProtection;
  }
  updateHud();
};

const phase4iUpdateBase = update;
update = function updatePhase4iGame(dt) {
  phase4iUpdateBase(dt);
  if (!player || (state !== 'playing' && state !== 'upgrading')) return;
  // Milestones create a second, predictable acquisition path beyond random
  // rescue events; do not change the existing player XP/upgrade curve.
  while (player.level >= phase4i.nextHatchLevel) {
    phase4iHatch();
    phase4i.nextHatchLevel += PHASE4I.hatchEveryLevels;
  }
};

// Keep progress readable without adding a management screen or touch buttons.
const phase4iPill = document.createElement('div');
phase4iPill.className = 'pill phase4i-pill';
phase4iPill.setAttribute('aria-label', '鸡群成长进度');
document.querySelector('#hud .hud-left')?.appendChild(phase4iPill);
const phase4iHudBase = updateHud;
updateHud = function updatePhase4iHud(force = false) {
  phase4iHudBase(force);
  if (!player) return;
  const living = phase4iLivingCount();
  phase4iPill.textContent = '鸡群 ' + living + '/' + PHASE4I.maxChicks
    + (living < PHASE4I.maxChicks ? ' · 下次孵化 Lv.' + phase4i.nextHatchLevel : ' · 已满员');
  phase4iPill.title = '通过迷路小鸡事件救援，或达到等级里程碑自然孵化新小鸡';
};
