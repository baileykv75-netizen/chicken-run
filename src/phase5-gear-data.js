// Phase 5C/D equipment catalog. Each definition maps to an actual combat or
// economic effect in phase5-arsenal.js; no placeholder equipment listings.
const PHASE5_GEAR = Object.freeze([
  {
    "id": "rotary",
    "name": "连发机铳",
    "category": "火力",
    "icon": "⚙️",
    "cost": 25,
    "cooldown": 0.85,
    "description": "自动连续射击；二级双弹道，三级多目标弹幕"
  },
  {
    "id": "storm-spear",
    "name": "雷霆长枪",
    "category": "火力",
    "icon": "⚡",
    "cost": 32,
    "cooldown": 1.65,
    "description": "直线贯穿；二级穿透提高，三级连锁雷击"
  },
  {
    "id": "sniper",
    "name": "猎狐狙击弩",
    "category": "火力",
    "icon": "🎯",
    "cost": 30,
    "cooldown": 2.3,
    "description": "优先狙击精英；二级提高暴击，三级穿甲重击"
  },
  {
    "id": "grenade",
    "name": "爆裂榴弹",
    "category": "火力",
    "icon": "💣",
    "cost": 33,
    "cooldown": 2.65,
    "description": "范围爆炸；二级扩大爆炸，三级留下灼烧区域"
  },
  {
    "id": "hammer",
    "name": "破阵重锤",
    "category": "守护",
    "icon": "🔨",
    "cost": 25,
    "cooldown": 1.6,
    "description": "近战击退；二级扩大冲击，三级附带眩晕"
  },
  {
    "id": "armor",
    "name": "铁壁装甲",
    "category": "守护",
    "icon": "🛡️",
    "cost": 26,
    "cooldown": 0,
    "description": "额外生命和减伤；二级强化护甲，三级低血量获得护盾"
  },
  {
    "id": "orbit",
    "name": "旋刃护环",
    "category": "守护",
    "icon": "🌀",
    "cost": 24,
    "cooldown": 1.2,
    "description": "周期近身伤害；二级双倍旋刃，三级范围扩张"
  },
  {
    "id": "thorns",
    "name": "反击刺甲",
    "category": "守护",
    "icon": "🌵",
    "cost": 25,
    "cooldown": 0,
    "description": "受到攻击时反伤；二级减速，三级触发反击震波"
  },
  {
    "id": "frost",
    "name": "冰霜法器",
    "category": "控制",
    "icon": "❄️",
    "cost": 26,
    "cooldown": 2.2,
    "description": "区域减速；二级扩散，三级冻结普通狐狸"
  },
  {
    "id": "pulse",
    "name": "雷电脉冲",
    "category": "控制",
    "icon": "🔋",
    "cost": 28,
    "cooldown": 2.8,
    "description": "电击打断冲锋；二级弹跳，三级连锁打断"
  },
  {
    "id": "gravity",
    "name": "引力核心",
    "category": "控制",
    "icon": "🪐",
    "cost": 34,
    "cooldown": 4,
    "description": "吸引附近狐狸；二级扩大范围，三级聚集爆发"
  },
  {
    "id": "trap",
    "name": "荆棘陷阱",
    "category": "控制",
    "icon": "🌿",
    "cost": 24,
    "cooldown": 3.2,
    "description": "在撤退路线上布置减速陷阱；三级缠绕"
  },
  {
    "id": "leech",
    "name": "生命汲取器",
    "category": "生存",
    "icon": "🩸",
    "cost": 27,
    "cooldown": 0,
    "description": "装备伤害转为自身治疗；二三级提高恢复效率"
  },
  {
    "id": "heal",
    "name": "治愈核心",
    "category": "生存",
    "icon": "💚",
    "cost": 30,
    "cooldown": 5,
    "description": "周期治疗自身；二级附近友军，三级群体恢复"
  },
  {
    "id": "shield",
    "name": "应急护盾",
    "category": "生存",
    "icon": "🔰",
    "cost": 28,
    "cooldown": 0,
    "description": "低血量获得短时护盾；三级护盾触发击退"
  },
  {
    "id": "drone",
    "name": "急救无人机",
    "category": "生存",
    "icon": "🚑",
    "cost": 32,
    "cooldown": 5.5,
    "description": "治疗低血量队友或玩家；三级提高恢复量"
  },
  {
    "id": "banner",
    "name": "战术指挥旗",
    "category": "战术",
    "icon": "🚩",
    "cost": 29,
    "cooldown": 0,
    "description": "附近小鸡提高输出；二三级扩大增益"
  },
  {
    "id": "lure",
    "name": "诱敌投影仪",
    "category": "战术",
    "icon": "🎭",
    "cost": 25,
    "cooldown": 6,
    "description": "生成诱饵吸引普通狐狸；三级消失后爆炸"
  },
  {
    "id": "radar",
    "name": "追踪雷达",
    "category": "战术",
    "icon": "📡",
    "cost": 23,
    "cooldown": 0,
    "description": "感知高危狐狸并在小地图标记；三级扩大侦测"
  },
  {
    "id": "salvager",
    "name": "战利品磁环",
    "category": "战术",
    "icon": "🧲",
    "cost": 24,
    "cooldown": 0,
    "description": "额外获得金币；二三级提高收益"
  },
  {
    "id": "echo",
    "name": "分身投影器",
    "category": "奇术",
    "icon": "👥",
    "cost": 35,
    "cooldown": 3,
    "description": "模仿一件已装备攻击武器；二三级提高伤害"
  },
  {
    "id": "timeslow",
    "name": "时间缓冲器",
    "category": "奇术",
    "icon": "⌛",
    "cost": 31,
    "cooldown": 4.5,
    "description": "阶段性减缓附近狐狸；三级扩大范围"
  },
  {
    "id": "phoenix",
    "name": "凤凰印记",
    "category": "奇术",
    "icon": "🔥",
    "cost": 42,
    "cooldown": 0,
    "description": "每次出征阻止一次致命伤害；二三级提高恢复"
  },
  {
    "id": "overdrive",
    "name": "过载能源炉",
    "category": "奇术",
    "icon": "☀️",
    "cost": 36,
    "cooldown": 5.5,
    "description": "加速其他武器冷却；三级强化并爆发"
  }
]);
const PHASE5_GEAR_BY_ID = Object.fromEntries(PHASE5_GEAR.map(g=>[g.id,g]));
