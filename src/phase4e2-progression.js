// Stage 4E.2: faster survivor-style progression without losing earned upgrade choices.
let stage4e2PendingUpgrades = 0;
let stage4e2OpeningUpgrade = false;

function stage4e2NextExperienceRequirement(currentRequirement) {
  return Math.max(4, Math.ceil(currentRequirement * 1.18 + 0.7));
}

function stage4e2ExperienceMultiplier() {
  const dangerBonus = Math.min(0.35, Math.max(0, dangerLevel - 1) * 0.035);
  return 1.5 + dangerBonus;
}

const stage4e2CreatePlayerBase = createPlayer;
createPlayer = function createStage4e2Player() {
  const next = stage4e2CreatePlayerBase();
  next.experienceNeeded = 3;
  return next;
};

const stage4e2ResetGameBase = resetGame;
resetGame = function resetStage4e2Progression() {
  stage4e2PendingUpgrades = 0;
  stage4e2OpeningUpgrade = false;
  stage4e2ResetGameBase();
};

function stage4e2OpenNextUpgrade() {
  if (
    stage4e2OpeningUpgrade ||
    stage4e2PendingUpgrades <= 0 ||
    state !== 'playing'
  ) return;

  stage4e2OpeningUpgrade = true;
  stage4e2PendingUpgrades -= 1;
  showUpgradeChoices();
  stage4e2OpeningUpgrade = false;
}

gainExperience = function gainStage4e2Experience(amount) {
  if (!player || !Number.isFinite(amount) || amount <= 0) return;

  const boostedAmount = amount * stage4e2ExperienceMultiplier();
  const cultivationLevel = skillLevel('rogue-cultivation');
  let playerAmount = boostedAmount;

  if (cultivationLevel > 0) {
    const target = ensureCultivatedChick();
    const share = cultivationLevel === 1 ? 0.3 : cultivationLevel === 2 ? 0.4 : 0.5;
    const diverted = boostedAmount * share;
    if (target && !target.lost) {
      player.cultivationExp += diverted;
      target.cultivationPower = 1 + Math.sqrt(player.cultivationExp) * 0.42;
      playerAmount -= diverted;
    }
  }

  player.experience += playerAmount;
  let levelsEarned = 0;

  while (player.experience >= player.experienceNeeded) {
    player.experience -= player.experienceNeeded;
    player.level += 1;
    player.experienceNeeded = stage4e2NextExperienceRequirement(player.experienceNeeded);
    stage4e2PendingUpgrades += 1;
    levelsEarned += 1;
  }

  updateHud(true);

  if (levelsEarned > 0) {
    addParticles(player.x, player.y - 18, '⭐', Math.min(4, levelsEarned + 1));
    stage4e2OpenNextUpgrade();
  }
};

const stage4e2DefeatFoxBase = defeatFox;
defeatFox = function defeatStage4e2Fox(fox) {
  const defeatedBefore = foxesDefeated;
  stage4e2DefeatFoxBase(fox);
  if (foxesDefeated <= defeatedBefore) return;

  // A small recurring payout makes dense waves produce visible progression bursts.
  if (foxesDefeated % 8 === 0) {
    const bonus = 2 + Math.min(2, Math.floor(Math.max(0, dangerLevel - 1) / 5));
    gainExperience(bonus);
    addParticles(fox.x, fox.y, '⭐', 3);
    playTone(980, 0.09, 0.04, 'triangle');
  }
};

// The original upgrade buttons return the state to playing. Open any queued level
// on the following task so every level earned receives a separate skill choice.
ui.upgradeChoices.addEventListener('click', (event) => {
  const button = event.target.closest('.upgrade-choice');
  if (!button) return;
  window.setTimeout(() => {
    stage4e2OpenNextUpgrade();
  }, 70);
});