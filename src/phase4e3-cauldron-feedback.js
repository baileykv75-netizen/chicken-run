// Stage 4E.3: make cauldron progress and the overlimit trigger understandable in play.
const stage4e3CauldronToast = document.createElement('div');
stage4e3CauldronToast.className = 'cauldron-toast hidden';
stage4e3CauldronToast.setAttribute('aria-live', 'polite');
document.querySelector('#app')?.append(stage4e3CauldronToast);

let stage4e3CauldronToastTimer = 0;

function stage4e3ShowCauldronToast(title, detail, ready = false) {
  window.clearTimeout(stage4e3CauldronToastTimer);
  stage4e3CauldronToast.innerHTML = `<span class="cauldron-toast-icon">🏺</span><div><strong>${title}</strong><small>${detail}</small></div>`;
  stage4e3CauldronToast.classList.toggle('ready', ready);
  stage4e3CauldronToast.classList.remove('hidden');
  requestAnimationFrame(() => stage4e3CauldronToast.classList.add('show'));
  stage4e3CauldronToastTimer = window.setTimeout(() => {
    stage4e3CauldronToast.classList.remove('show');
    window.setTimeout(() => stage4e3CauldronToast.classList.add('hidden'), 220);
  }, ready ? 3600 : 2100);
}

function stage4e3CauldronDetail() {
  if (!player || skillLevel('break-cauldron') <= 0) return '';
  if (player.overlimitChosen) return '🏺 已破鼎 · 超限完成';
  const energy = Math.floor(player.cauldronEnergy || 0);
  if (player.cauldronReady) return '🏺 鼎火已满 · 下次升级选择超限';
  return `🏺 鼎火 ${energy}/${STAGE4C_CAULDRON_GOAL}`;
}

const stage4e3ChargeCauldronBase = stage4cChargeCauldron;
stage4cChargeCauldron = function chargeStage4e3Cauldron(amount) {
  const before = Math.floor(player?.cauldronEnergy || 0);
  const wasReady = Boolean(player?.cauldronReady);
  stage4e3ChargeCauldronBase(amount);

  if (!player || skillLevel('break-cauldron') <= 0 || player.overlimitChosen) return;
  const after = Math.floor(player.cauldronEnergy || 0);
  if (after <= before) return;

  const milestones = [5, 10, 15];
  const crossed = milestones.find((value) => before < value && after >= value);
  if (crossed) {
    stage4e3ShowCauldronToast(
      `鼎火 ${after}/${STAGE4C_CAULDRON_GOAL}`,
      '普通/迅捷狐狸 +1，蛮力狐狸 +3，救鸡额外 +2',
    );
  }

  if (!wasReady && player.cauldronReady) {
    stage4e3ShowCauldronToast(
      '鼎火已满，可以破鼎！',
      '下一次升级将出现当前武器的两条超限路线',
      true,
    );
    ui.cauldronPill?.classList.add('cauldron-ready-pulse');
  }
};

const stage4e3ApplyOverlimitBase = stage4cApplyOverlimit;
stage4cApplyOverlimit = function applyStage4e3Overlimit(route) {
  stage4e3ApplyOverlimitBase(route);
  ui.cauldronPill?.classList.remove('cauldron-ready-pulse');
  stage4e3ShowCauldronToast('破鼎成功', '当前武器已完成超限进化', true);
};

const stage4e3WeaponSummaryBase = stage4dWeaponSummary;
stage4dWeaponSummary = function stage4e3WeaponSummary() {
  const base = stage4e3WeaponSummaryBase();
  const detail = stage4e3CauldronDetail();
  return detail ? `${base} · ${detail}` : base;
};

const stage4e3UpdateHudBase = updateHud;
updateHud = function updateStage4e3CauldronHud(force = false) {
  stage4e3UpdateHudBase(force);
  if (!player || !ui.cauldronPill) return;
  ui.cauldronPill.title = skillLevel('break-cauldron') > 0
    ? '普通/迅捷狐狸 +1；蛮力狐狸 +3；救回被抓小鸡额外 +2；20 点鼎火满鼎'
    : '';
  ui.cauldronPill.classList.toggle(
    'cauldron-ready-pulse',
    Boolean(player.cauldronReady && !player.overlimitChosen),
  );
};