// Phase 4D-2: lightweight SVG sprite art pass with vector fallbacks.
const stage4d2SpriteSources = {
  guardian: './assets/sprites/guardian.svg',
  chick: './assets/sprites/chick.svg',
  chickAwakened: './assets/sprites/chick-awakened.svg',
  foxNormal: './assets/sprites/fox-normal.svg',
  foxSwift: './assets/sprites/fox-swift.svg',
  foxBrute: './assets/sprites/fox-brute.svg',
  brucie: './assets/sprites/brucie.svg',
  sword: './assets/sprites/sword.svg',
  spear: './assets/sprites/spear.svg',
  hammer: './assets/sprites/hammer.svg',
};

const stage4d2Sprites = Object.create(null);
for (const [key, source] of Object.entries(stage4d2SpriteSources)) {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  stage4d2Sprites[key] = image;
}

function stage4d2Ready(key) {
  const image = stage4d2Sprites[key];
  return Boolean(image?.complete && image.naturalWidth > 0);
}

function stage4d2DrawImage(key, x, y, widthValue, heightValue, rotation = 0, flipX = false, alpha = 1) {
  if (!stage4d2Ready(key)) return false;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(flipX ? -1 : 1, 1);
  context.globalAlpha *= alpha;
  context.drawImage(stage4d2Sprites[key], -widthValue / 2, -heightValue / 2, widthValue, heightValue);
  context.restore();
  return true;
}

const stage4d2DrawChickFallback = drawChick;
drawChick = function drawStage4d2Chick(chick) {
  if (chick.lost || chick.scouting || chick.carriedBy) return;
  const bob = Math.sin(chick.phase || elapsed * 5) * 1.5;
  const cultivated = Boolean(chick.cultivated);
  const awakened = Boolean(chick.awakened);
  if (cultivated) {
    context.save();
    context.strokeStyle = 'rgba(126,82,190,.68)';
    context.lineWidth = 2.2;
    context.beginPath();
    context.arc(chick.x, chick.y + 3, 16 + Math.sin(elapsed * 4) * 1.5, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  const key = awakened ? 'chickAwakened' : 'chick';
  const size = awakened ? 33 : 29;
  if (!stage4d2DrawImage(key, chick.x, chick.y - 1 + bob, size, size)) stage4d2DrawChickFallback(chick);
  if ((chick.protectedFor || 0) > 0) {
    context.save();
    context.strokeStyle = 'rgba(118,188,255,.75)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(chick.x, chick.y + 1, 17, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
};

const stage4d2DrawFoxFallback = drawFox;
drawFox = function drawStage4d2Fox(fox) {
  if (fox.dead || fox.health <= 0) return;
  const target = fox.carrying ? nearestWorldEdgeVector(fox.x, fox.y) : fox.target || player;
  const angle = fox.carrying
    ? Math.atan2(target.y, target.x)
    : Math.atan2(target.y - fox.y, target.x - fox.x);
  const key = fox.type === 'swift' ? 'foxSwift' : fox.type === 'brute' ? 'foxBrute' : 'foxNormal';
  const widthValue = fox.type === 'brute' ? 57 : fox.type === 'swift' ? 49 : 51;
  const heightValue = fox.type === 'brute' ? 44 : 36;
  const alpha = fox.hitFlash > 0 ? 0.55 : 1;
  if (!stage4d2DrawImage(key, fox.x, fox.y, widthValue, heightValue, angle, false, alpha)) {
    stage4d2DrawFoxFallback(fox);
    return;
  }

  if (fox.carrying) {
    stage4d2DrawImage('chick', fox.x - Math.sin(angle) * 13, fox.y + Math.cos(angle) * 13 - 5, 25, 25, angle + Math.PI / 2);
    context.save();
    context.fillStyle = '#d84242';
    context.font = '900 17px sans-serif';
    context.textAlign = 'center';
    context.fillText('!', fox.x, fox.y - heightValue * 0.7);
    context.restore();
  }

  if (fox.stunnedFor > 0) {
    context.save();
    context.fillStyle = '#ffe66d';
    context.font = '14px sans-serif';
    context.textAlign = 'center';
    context.fillText('✦  ✦', fox.x, fox.y - heightValue * 0.65);
    context.restore();
  }

  if (fox.health < fox.maxHealth && fox.health > 0) {
    const barWidth = fox.type === 'brute' ? 42 : 34;
    roundedRectangle(fox.x - barWidth / 2, fox.y - heightValue * 0.68 - 8, barWidth, 4, 3, 'rgba(61,41,31,.25)');
    roundedRectangle(
      fox.x - barWidth / 2,
      fox.y - heightValue * 0.68 - 8,
      barWidth * clamp(fox.health / fox.maxHealth, 0, 1),
      4,
      3,
      '#e65d5d',
    );
  }
};

const stage4d2DrawPlayerFallback = drawPlayer;
drawPlayer = function drawStage4d2Player() {
  if (!player) return;
  const angle = Math.atan2(player.facing.y, player.facing.x);
  const blinkAlpha = player.invulnerableFor > 0 && Math.floor(elapsed * 14) % 2 === 0 ? 0.45 : 1;
  const bob = Math.sin(elapsed * (player.moving?.x || player.moving?.y ? 10 : 4)) * (player.moving?.x || player.moving?.y ? 1.8 : 0.7);

  if (!stage4d2DrawImage('guardian', player.x, player.y - 2 + bob, 48, 48, 0, false, blinkAlpha)) {
    stage4d2DrawPlayerFallback();
    return;
  }

  context.save();
  context.translate(player.x, player.y - 1 + bob);
  context.rotate(angle);
  context.globalAlpha *= blinkAlpha;
  if (player.gunMode) {
    context.strokeStyle = '#424b55';
    context.lineWidth = player.gunArchetype === 'shotgun' ? 6 : 4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(player.gunArchetype === 'revolver' ? 27 : 37, 0);
    context.stroke();
    context.fillStyle = '#8d633b';
    context.fillRect(12, 2, 8, 9);
  } else {
    const weaponKey = player.weapon === 'spear' ? 'spear' : player.weapon === 'hammer' ? 'hammer' : 'sword';
    const weaponWidth = player.weapon === 'spear' ? 58 : player.weapon === 'hammer' ? 46 : 44;
    const weaponHeight = player.weapon === 'hammer' ? 34 : 18;
    if (stage4d2Ready(weaponKey)) context.drawImage(stage4d2Sprites[weaponKey], 4, -weaponHeight / 2, weaponWidth, weaponHeight);
  }
  context.restore();

  const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
  roundedRectangle(player.x - 22, player.y + 27, 44, 6, 4, 'rgba(61,41,31,.22)');
  roundedRectangle(player.x - 22, player.y + 27, 44 * healthRatio, 6, 4, healthRatio > 0.35 ? '#e86464' : '#ffb23e');
};

if (typeof drawStage4bDog === 'function') {
  const stage4d2DrawDogFallback = drawStage4bDog;
  drawStage4bDog = function drawStage4d2Dog(dog) {
    const bob = Math.sin(dog.phase || 0) * 2;
    if (!stage4d2DrawImage('brucie', dog.x, dog.y + bob, 46, 38)) stage4d2DrawDogFallback(dog);
  };
}
