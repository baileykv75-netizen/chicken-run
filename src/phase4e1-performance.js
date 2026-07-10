// Stage 4E.1 performance pass: lower mobile raster cost and avoid needless DOM/effect work.
const stage4e1TouchDevice = isTouchDevice();

resizeCanvas = function resizeStage4e1Canvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  const maximumScale = stage4e1TouchDevice ? 1.5 : 2;
  deviceScale = Math.min(window.devicePixelRatio || 1, maximumScale);
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = stage4e1TouchDevice ? 'medium' : 'high';
  updateWorldSize();
  clampCamera();
};

const stage4e1UpdateHudBase = updateHud;
let stage4e1LastHudUpdate = -Infinity;
let stage4e1LastLevel = -1;
let stage4e1LastDanger = -1;
let stage4e1LastAlive = -1;
let stage4e1LastWeapon = '';

updateHud = function updateStage4e1ThrottledHud(force = false) {
  if (!player) {
    stage4e1UpdateHudBase();
    return;
  }

  let alive = 0;
  for (const chick of chicks) {
    if (!chick.lost) alive += 1;
  }

  const now = performance.now();
  const urgent = force ||
    state !== 'playing' ||
    player.level !== stage4e1LastLevel ||
    dangerLevel !== stage4e1LastDanger ||
    alive !== stage4e1LastAlive ||
    player.weapon !== stage4e1LastWeapon;

  if (!urgent && now - stage4e1LastHudUpdate < 100) return;

  stage4e1LastHudUpdate = now;
  stage4e1LastLevel = player.level;
  stage4e1LastDanger = dangerLevel;
  stage4e1LastAlive = alive;
  stage4e1LastWeapon = player.weapon;
  stage4e1UpdateHudBase();
};

const stage4e1AddParticlesBase = addParticles;
addParticles = function addStage4e1AdaptiveParticles(x, y, symbol, count = 4) {
  const heavyLoad = stage4cLowFxMode ||
    (stage4e1TouchDevice && (foxes.length >= 18 || spearShots.length >= 4));

  if (!heavyLoad) {
    stage4e1AddParticlesBase(x, y, symbol, count);
    return;
  }

  let allowed = count;
  if (symbol === '✦' || symbol === '💨') allowed = Math.min(1, count);
  else if (symbol === '💥') allowed = Math.min(3, count);
  else allowed = Math.min(2, count);

  if (allowed > 0) stage4e1AddParticlesBase(x, y, symbol, allowed);
};

// Apply the reduced mobile pixel ratio immediately; future resize events use this override too.
resizeCanvas();