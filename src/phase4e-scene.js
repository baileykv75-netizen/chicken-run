// Phase 4E: illustrated farm scenery and lightweight danger tinting.
const stage4eSceneSources = {
  coop: './assets/scenery/coop.svg',
  pond: './assets/scenery/pond.svg',
  hay: './assets/scenery/hay-bale.svg',
  fence: './assets/scenery/fence.svg',
};

const stage4eSceneImages = Object.create(null);
for (const [key, source] of Object.entries(stage4eSceneSources)) {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  stage4eSceneImages[key] = image;
}

function stage4eSceneReady(key) {
  const image = stage4eSceneImages[key];
  return Boolean(image?.complete && image.naturalWidth > 0);
}

function stage4eDrawSceneImage(key, x, y, widthValue, heightValue, rotation = 0, alpha = 1) {
  if (!stage4eSceneReady(key)) return false;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha *= alpha;
  context.drawImage(stage4eSceneImages[key], -widthValue / 2, -heightValue / 2, widthValue, heightValue);
  context.restore();
  return true;
}

const stage4eGrassTile = document.createElement('canvas');
stage4eGrassTile.width = 96;
stage4eGrassTile.height = 96;
const stage4eGrassContext = stage4eGrassTile.getContext('2d');
stage4eGrassContext.fillStyle = 'rgba(255,255,255,.035)';
stage4eGrassContext.beginPath();
stage4eGrassContext.arc(18, 21, 2.2, 0, Math.PI * 2);
stage4eGrassContext.arc(68, 58, 1.7, 0, Math.PI * 2);
stage4eGrassContext.fill();
stage4eGrassContext.strokeStyle = 'rgba(52,112,58,.12)';
stage4eGrassContext.lineWidth = 2;
for (const [x, y, angle] of [[14, 67, -.35], [45, 26, .25], [77, 82, -.1], [86, 17, .45]]) {
  stage4eGrassContext.save();
  stage4eGrassContext.translate(x, y);
  stage4eGrassContext.rotate(angle);
  stage4eGrassContext.beginPath();
  stage4eGrassContext.moveTo(0, 6);
  stage4eGrassContext.lineTo(-2, 0);
  stage4eGrassContext.moveTo(0, 6);
  stage4eGrassContext.lineTo(3, 1);
  stage4eGrassContext.stroke();
  stage4eGrassContext.restore();
}
const stage4eGrassPattern = context.createPattern(stage4eGrassTile, 'repeat');

let stage4eGradientCache = null;
let stage4eGradientCacheKey = '';

function stage4eBackgroundGradient(pressure) {
  const pressureStep = Math.round(pressure * 20) / 20;
  const key = `${world.width}:${world.height}:${pressureStep}`;
  if (stage4eGradientCache && stage4eGradientCacheKey === key) return stage4eGradientCache;

  const gradient = context.createLinearGradient(0, 0, 0, world.height);
  gradient.addColorStop(0, `hsl(${108 - pressureStep * 9} 47% ${70 - pressureStep * 5}%)`);
  gradient.addColorStop(1, `hsl(${119 - pressureStep * 7} 39% ${56 - pressureStep * 5}%)`);
  stage4eGradientCache = gradient;
  stage4eGradientCacheKey = key;
  return gradient;
}

function stage4eVisibleBounds(margin = 160) {
  const halfWidth = width / (2 * camera.zoom) + margin;
  const halfHeight = height / (2 * camera.zoom) + margin;
  return {
    left: camera.x - halfWidth,
    right: camera.x + halfWidth,
    top: camera.y - halfHeight,
    bottom: camera.y + halfHeight,
  };
}

function stage4eDrawVisibleFences(bounds) {
  if (!stage4eSceneReady('fence')) return;
  const spacing = 190;
  const horizontalStart = Math.max(0, Math.floor(bounds.left / spacing) * spacing);
  const horizontalEnd = Math.min(world.width, bounds.right + spacing);

  if (bounds.top < 96) {
    for (let x = horizontalStart; x <= horizontalEnd; x += spacing) {
      stage4eDrawSceneImage('fence', x + spacing / 2, 43, spacing + 10, 62);
    }
  }
  if (bounds.bottom > world.height - 96) {
    for (let x = horizontalStart; x <= horizontalEnd; x += spacing) {
      stage4eDrawSceneImage('fence', x + spacing / 2, world.height - 43, spacing + 10, 62, Math.PI);
    }
  }

  const verticalStart = Math.max(0, Math.floor(bounds.top / spacing) * spacing);
  const verticalEnd = Math.min(world.height, bounds.bottom + spacing);
  if (bounds.left < 96) {
    for (let y = verticalStart; y <= verticalEnd; y += spacing) {
      stage4eDrawSceneImage('fence', 43, y + spacing / 2, spacing + 10, 62, Math.PI / 2);
    }
  }
  if (bounds.right > world.width - 96) {
    for (let y = verticalStart; y <= verticalEnd; y += spacing) {
      stage4eDrawSceneImage('fence', world.width - 43, y + spacing / 2, spacing + 10, 62, -Math.PI / 2);
    }
  }
}

const stage4eDrawBackgroundFallback = drawBackground;
drawBackground = function drawStage4eBackground() {
  if (!player && state !== 'menu') {
    stage4eDrawBackgroundFallback();
    return;
  }

  const danger = typeof dangerLevel === 'number' ? dangerLevel : 1;
  const pressure = clamp((danger - 1) / 10, 0, 1);
  const bounds = stage4eVisibleBounds();
  const visibleLeft = Math.max(0, bounds.left);
  const visibleRight = Math.min(world.width, bounds.right);
  const visibleTop = Math.max(0, bounds.top);
  const visibleBottom = Math.min(world.height, bounds.bottom);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);

  if (visibleWidth <= 0 || visibleHeight <= 0) return;

  context.save();
  context.beginPath();
  context.rect(visibleLeft, visibleTop, visibleWidth, visibleHeight);
  context.clip();

  context.fillStyle = stage4eBackgroundGradient(pressure);
  context.fillRect(visibleLeft, visibleTop, visibleWidth, visibleHeight);

  if (stage4eGrassPattern) {
    context.fillStyle = stage4eGrassPattern;
    context.fillRect(visibleLeft, visibleTop, visibleWidth, visibleHeight);
  }

  context.save();
  context.globalAlpha = 0.28;
  context.strokeStyle = '#e6c58b';
  context.lineWidth = 82;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(world.width * 0.03, world.height * 0.53);
  context.bezierCurveTo(
    world.width * 0.26,
    world.height * 0.34,
    world.width * 0.68,
    world.height * 0.7,
    world.width * 0.97,
    world.height * 0.47,
  );
  context.stroke();
  context.globalAlpha = 0.12;
  context.strokeStyle = '#9f713f';
  context.lineWidth = 5;
  context.setLineDash([13, 20]);
  context.stroke();
  context.restore();

  const safeX = world.width / 2;
  const safeY = world.height / 2;
  if (
    safeX + 285 >= bounds.left && safeX - 285 <= bounds.right &&
    safeY + 210 >= bounds.top && safeY - 210 <= bounds.bottom
  ) {
    context.save();
    context.fillStyle = 'rgba(255,241,174,.18)';
    context.beginPath();
    context.ellipse(safeX, safeY, 285, 210, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const sceneItems = [
    ['coop', world.width * 0.18, world.height * 0.22, 185, 143],
    ['pond', world.width * 0.75, world.height * 0.28, 225, 141],
  ];
  for (const [key, x, y, itemWidth, itemHeight] of sceneItems) {
    if (x + itemWidth < bounds.left || x - itemWidth > bounds.right || y + itemHeight < bounds.top || y - itemHeight > bounds.bottom) continue;
    const drawn = stage4eDrawSceneImage(key, x, y, itemWidth, itemHeight);
    if (!drawn) {
      if (key === 'coop') drawCoop();
      else drawPond();
    }
  }

  const hayPositions = [
    [world.width * 0.22, world.height * 0.67, -0.08],
    [world.width * 0.78, world.height * 0.62, 0.05],
    [world.width * 0.64, world.height * 0.82, -0.12],
    [world.width * 0.36, world.height * 0.38, 0.1],
    [world.width * 0.83, world.height * 0.42, -0.04],
  ];
  for (const [x, y, rotation] of hayPositions) {
    if (x < bounds.left - 80 || x > bounds.right + 80 || y < bounds.top - 60 || y > bounds.bottom + 60) continue;
    if (!stage4eDrawSceneImage('hay', x, y, 92, 61, rotation)) {
      context.save();
      context.translate(x, y);
      roundedRectangle(-24, -14, 48, 28, 8, '#e9bd4d');
      context.restore();
    }
  }

  stage4eDrawVisibleFences(bounds);

  context.save();
  context.globalAlpha = 0.48;
  const decorationStep = stage4cLowFxMode || foxes.length >= 20 ? 2 : 1;
  for (let index = 0; index < decorations.length; index += decorationStep) {
    const decoration = decorations[index];
    if (decoration.x < bounds.left || decoration.x > bounds.right || decoration.y < bounds.top || decoration.y > bounds.bottom) continue;
    context.fillStyle = decoration.variant > 0.66 ? '#fff2ad' : decoration.variant > 0.33 ? '#f3a9c0' : '#d6e98e';
    context.beginPath();
    context.arc(decoration.x, decoration.y, decoration.size, 0, Math.PI * 2);
    context.fill();
    if (!stage4cLowFxMode && decoration.size > 3.3) {
      context.strokeStyle = 'rgba(74,112,57,.5)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(decoration.x, decoration.y + decoration.size);
      context.lineTo(decoration.x - 1, decoration.y + decoration.size + 7);
      context.stroke();
    }
  }
  context.restore();

  if (pressure > 0.02) {
    context.fillStyle = `rgba(92,48,76,${0.025 + pressure * 0.09})`;
    context.fillRect(visibleLeft, visibleTop, visibleWidth, visibleHeight);
  }

  context.restore();
};

const stage4eUpdateHudBase = updateHud;
updateHud = function updateStage4eHud() {
  stage4eUpdateHudBase();
  const danger = typeof dangerLevel === 'number' ? dangerLevel : 1;
  document.documentElement.style.setProperty('--danger-pressure', String(clamp((danger - 1) / 10, 0, 1)));
  if (ui.waveNotice) ui.waveNotice.dataset.danger = String(danger);
};