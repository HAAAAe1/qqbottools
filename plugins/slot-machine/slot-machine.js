// 耄耋机 —— #耄耋机 [下注额] / #耄耋机排行
// 水果机 + 炸弹 + 耄耋玩法，纯虚拟币娱乐
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data', 'slot-data.json')

const SYMBOLS = [
  { emoji: '🍒', name: '樱桃', weight: 25, multi: 5 },
  { emoji: '🍋', name: '柠檬', weight: 25, multi: 5 },
  { emoji: '🍊', name: '橙子', weight: 25, multi: 5 },
  { emoji: '🔔', name: '铃铛', weight: 12, multi: 10 },
  { emoji: '⭐', name: '星星', weight: 8,  multi: 10 },
  { emoji: '💎', name: '钻石', weight: 4,  multi: 20 },
  { emoji: '7️⃣',  name: '7号',   weight: 1,  multi: 77 },
  { emoji: '💣', name: '炸弹', weight: 10, multi: -1 },
  { emoji: '🐱', name: '耄耋', weight: 3,  multi: 0 }
]

const BOMB = '💣'
const MAODIE = '🐱'
const INIT_COINS = 100000
const DAILY_REFILL = 100000
const FREE_SPINS = 3
const FREE_BET = 5000
const DEFAULT_BET = 5000

const STREAK_MULTI = { 2: 1.2, 3: 1.5, 5: 2 }
const MINE_ITEMS = [
  { emoji: '💎', name: '宝石', weight: 5, value: 50000 },
  { emoji: '🪨', name: '煤炭', weight: 30, value: 5000 },
  { emoji: '🪹', name: '空洞', weight: 20, value: 0 },
  { emoji: '🐱', name: '耄耋', weight: 1, value: 1000000 },
  { emoji: '🔥', name: '火焰石', weight: 5, value: 20000 },
  { emoji: '⭐', name: '星尘', weight: 10, value: 10000 },
  { emoji: '🪙', name: '金币矿', weight: 15, value: 3000 },
  { emoji: '💠', name: '碎钻', weight: 14, value: 15000 }
]
const MINE_CD = 30000 // 挖矿冷却30秒
const mineCooldown = new Map()
const DUEL_EXPIRE = 120000 // 对战邀请2分钟过期
const pendingDuels = new Map() // challengerId → { targetId, amount, expiry }
/**
 * 管理员列表（耄耋机的加币 / 清空 / 封禁等管理命令用）
 * 优先级：环境变量 QQBOT_ADMINS（逗号或空格分隔）→ 同目录 data/admins.json（数组，或 {admins:[...]}）
 * 2026-10-28 从硬编码改成外部读取，避免个人 QQ 号进入公开仓库
 */
const ADMINS = (() => {
  if (process.env.QQBOT_ADMINS) return process.env.QQBOT_ADMINS.split(/[,\s]+/).filter(Boolean)
  try {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'admins.json'), 'utf8'))
    const arr = Array.isArray(v) ? v : ((v && v.admins) || [])
    return arr.map(String)
  } catch { return [] }
})()

// === 老虎机已停用（2026-09-28 封号） ===
const SLOT_DISABLED = true

// === 大冒险常量 ===
const ADV_FEE = 10000
const ADV_INIT_HP = 100

// === 大冒险事件池 ===
const ADV_EVENTS = [
  { id: 'blessDice', name: '骰子祝福', weight: 12 },
  { id: 'curseDice', name: '贪婪之心', weight: 10 },
  { id: 'sharpEye', name: '精准之眼', weight: 8 },
  { id: 'ageCurse', name: '玻璃碎片', weight: 8 },
  { id: 'lifeHeart', name: '生命之心', weight: 15 },
  { id: 'bloodRitual', name: '血祭', weight: 10 },
  { id: 'mushroom', name: '毒蘑菇', weight: 10 },
  { id: 'strPotion', name: '力量药剂', weight: 12 },
  { id: 'battleAwake', name: '战意觉醒', weight: 8 },
  { id: 'weakPoint', name: '弱点侦查', weight: 10 },
  { id: 'shieldShard', name: '护盾碎片', weight: 12 },
  { id: 'ironWall', name: '铁壁祝福', weight: 8 },
  { id: 'thornArmor', name: '荆棘之甲', weight: 8 },
  { id: 'treasure', name: '宝箱', weight: 15 },
  { id: 'gamble', name: '赌石', weight: 10 },
  { id: 'merchant', name: '神秘商人', weight: 8 },
  { id: 'greedDoor', name: '贪婪之门', weight: 6 },
  { id: 'curseBox', name: '恶魔契约', weight: 5 }
]

// === 大冒险商店 ===
const ADV_SHOP = [
  { id: 'potion', name: '血瓶', price: 5000, cat: '❤️', desc: '+30血' },
  { id: 'bigPotion', name: '大血瓶', price: 12000, cat: '❤️', desc: '+60血' },
  { id: 'lifeHeart', name: '生命之心', price: 20000, cat: '❤️', desc: '+20血上限+20血' },
  { id: 'revive', name: '重生十字', price: 25000, cat: '❤️', desc: '死亡时复活（50%血量）' },
  { id: 'atkPotion', name: '攻击药水', price: 8000, cat: '⚔️', desc: '攻击+3' },
  { id: 'mastery', name: '战斗精通', price: 15000, cat: '⚔️', desc: '攻击+5' },
  { id: 'critNecklace', name: '暴击项链', price: 18000, cat: '⚔️', desc: '暴击率+10%' },
  { id: 'diceBag', name: '骰子袋', price: 12000, cat: '🎲', desc: '骰子+1颗' },
  { id: 'luckyDice', name: '幸运骰子', price: 16000, cat: '🎲', desc: '骰子点数+1' },
  { id: 'shield', name: '护盾', price: 10000, cat: '🛡️', desc: '挡一次Boss攻击' },
  { id: 'ironWall', name: '铁壁', price: 15000, cat: '🛡️', desc: '每回合减伤5' },
  { id: 'thorns', name: '反甲', price: 20000, cat: '🛡️', desc: '被攻击反弹10伤害' },
  { id: 'lifesteal', name: '生命汲取', price: 18000, cat: '🛡️', desc: '攻击回复10%伤害血量' },
  { id: 'maodieEye', name: '耄耋之眼', price: 25000, cat: '✨', desc: '看到全部出招表 | Boss攻击+5' },
  { id: 'luckyClover', name: '幸运草', price: 10000, cat: '✨', desc: '暴击×3 | 暴击率-10%' },
  { id: 'gamblerHeart', name: '赌徒之心', price: 15000, cat: '✨', desc: '骰子上限30 | 下限-5' },
  { id: 'maodieBless', name: '耄耋祝福', price: 30000, cat: '✨', desc: '骰子+5点 | 最大血量-20' },
  { id: 'thiefGlove', name: '偷窃手套', price: 20000, cat: '✨', desc: 'Boss奖励+50% | Boss血量+30%' }
]

// === Boss配置 ===
const ADV_BOSS_NAMES = [
  '远古耄耋', '暴怒耄耋', '暗影耄耋', '狂暴耄耋', '???耄耋',
  '堕落耄耋', '冰霜耄耋', '烈焰耄耋', '雷霆耄耋', '虚空耄耋'
]
const ADV_BOSS_PATTERNS = [
  { type: 'slash', name: '劈砍', baseDmg: 35, desc: '⚔️ 劈砍（玩家骰子-1）' },
  { type: 'heavy', name: '重击', baseDmg: 65, desc: '💥 重击（下回合Boss伤害-20）' },
  { type: 'charge', name: '蓄力', baseDmg: 0, desc: '🛡️ 蓄力（下回合攻击×2）' },
  { type: 'combo', name: '连击', baseDmg: 30, desc: '⚡ 连击（5段，每段吃防御）' },
  { type: 'drain', name: '吸血', baseDmg: 30, desc: '🩸 吸血（回复30HP）' },
  { type: 'poison', name: '毒雾', baseDmg: 15, desc: '☠️ 毒雾（每回合-10血）' },
  { type: 'ultimate', name: '毁灭一击', baseDmg: 90, desc: '💀 毁灭一击！' }
]

// === 诅咒系统 ===
const ADV_CURSES = [
  { id: 'bleed', name: '嗜血', desc: '每回合-2血', tier: 1 },
  { id: 'weak', name: '虚弱', desc: '攻击-2', tier: 1 },
  { id: 'diminish', name: '感知下降', desc: '骰子点数-1', tier: 1 },
  { id: 'taunt', name: '嘲讽', desc: 'Boss每回合+5攻击', tier: 1 },
  { id: 'frail', name: '脆弱', desc: '最大血量-10', tier: 1 },
  { id: 'fog', name: '迷雾', desc: 'Boss出招表隐藏1回合', tier: 1 },
  { id: 'greed', name: '贪婪', desc: '商店价格+30%', tier: 1 },
  { id: 'pressure', name: '压力', desc: '防御减伤-3', tier: 2 },
  { id: 'slow', name: '迟钝', desc: '骰子-3颗', tier: 2 },
  { id: 'mock', name: '嘲弄', desc: 'Boss蓄力改为攻击', tier: 2 },
  { id: 'toxic', name: '淬毒', desc: '被攻击额外+5伤害', tier: 2 },
  { id: 'crack', name: '裂甲', desc: '护盾只挡50%伤害', tier: 2 },
  { id: 'devour', name: '吞噬', desc: '每轮随机属性-2', tier: 2 },
  { id: 'pact', name: '契约', desc: '骰子下限-15', tier: 3 },
  { id: 'recoil', name: '反噬', desc: '暴击时自伤25', tier: 3 },
  { id: 'bone', name: '削骨', desc: '防御-20', tier: 3 }
]

function rollDice (count, bonus, max) {
  const diceMax = max || 20
  const results = []
  for (let i = 0; i < count; i++) {
    let v = Math.floor(Math.random() * diceMax) + (bonus || 0)
    // 不设上下限，保留原始数值
    results.push(v)
  }
  return results
}

function applyCurses (adv) {
  const cc = adv.curses || []
  if (cc.includes('weak')) adv.attack -= 2
  if (cc.includes('frail')) adv.maxHp -= 10
  if (cc.includes('diminish')) adv.diceBonus -= 1
  if (cc.includes('slow')) adv.dice = Math.max(1, adv.dice - 3)
  if (cc.includes('bone')) adv.dmgReduce -= 20
}

function randInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function loadData () {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveData (data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
}

function getPlayer (data, uid) {
  const today = new Date().toISOString().slice(0, 10)
  if (!data[uid]) {
    data[uid] = { coins: INIT_COINS, lastDay: today, freeSpins: FREE_SPINS, streak: 0, bestStreak: 0, totalWin: 0, biggestWin: 0, advBestFloor: 0, advBestCoins: 0 }
  }
  if (data[uid].lastDay !== today) {
    data[uid].lastDay = today
    data[uid].freeSpins = FREE_SPINS
    if (data[uid].coins < 100) data[uid].coins = Math.max(data[uid].coins, DAILY_REFILL)
  }
  return data[uid]
}

function weightedRandom () {
  const total = SYMBOLS.reduce((s, sym) => s + sym.weight, 0)
  let r = Math.random() * total
  for (const sym of SYMBOLS) {
    r -= sym.weight
    if (r <= 0) return sym
  }
  return SYMBOLS[0]
}

function spin () {
  return [weightedRandom(), weightedRandom(), weightedRandom()]
}

function calcResult (reels, bet) {
  // 三只耄耋：代币归零
  if (reels.every(r => r.emoji === MAODIE)) {
    return { type: 'maodie', payout: 0 }
  }

  const bombCount = reels.filter(r => r.emoji === BOMB).length

  // 炸弹惩罚
  if (bombCount > 0) {
    const multi = bombCount === 1 ? 1 : bombCount === 2 ? 1.5 : 2
    return { type: 'bomb', bombCount, multi, payout: -Math.floor(bet * multi) }
  }

  // 三个相同
  if (reels[0].emoji === reels[1].emoji && reels[1].emoji === reels[2].emoji) {
    const sym = reels[0]
    return { type: 'triple', sym, payout: bet * sym.multi }
  }

  // 两个相同
  if (reels[0].emoji === reels[1].emoji || reels[1].emoji === reels[2].emoji || reels[0].emoji === reels[2].emoji) {
    return { type: 'double', payout: bet * 2 }
  }

  return { type: 'miss', payout: 0 }
}

function getStreakMulti (streak) {
  if (streak >= 5) return 2
  if (streak >= 3) return 1.5
  if (streak >= 2) return 1.2
  return 1
}

function streakMsg (streak) {
  const m = getStreakMulti(streak)
  if (m > 1) return `🔥 ${streak}连胜！倍率 ×${m}！`
  return ''
}

export class SlotMachine extends plugin {
  constructor () {
    super({
      name: '耄耋机',
      dsc: '虚拟币耄耋机小游戏',
      event: 'message',
      priority: 500,
      rule: [
        // 老虎机/借贷/排行/对战已禁用（2026-09-28 封号）
        // { reg: /^#耄耋机$/, fnc: 'play' },
        // { reg: /^#耄耋机\s+(\d+)$/, fnc: 'playBet' },
        // { reg: /^#耄耋机借\s*(\d+)$/, fnc: 'borrow' },
        // { reg: /^#耄耋机还\s*(\d+)$/, fnc: 'repay' },
        // { reg: /^#耄耋机排行榜?$/, fnc: 'leaderboard' },
        // { reg: /^#耄耋机余额$/, fnc: 'myCoins' },
        // { reg: /^#耄耋机功能$/, fnc: 'features' },
        { reg: /^#耄耋机挖矿$/, fnc: 'mine' },
        // 欠款/管理/对战已禁用（2026-09-28 封号）
        // { reg: /^#耄耋机欠款榜$/, fnc: 'debtBoard' },
        // { reg: /^#耄耋机欠款$/, fnc: 'myDebt' },
        // { reg: /^#耄耋机清空\s+(\d+)$/, fnc: 'adminClear' },
        // { reg: /^#耄耋机还清\s+(\d+)$/, fnc: 'adminClearDebt' },
        // { reg: /^#耄耋机驱逐\s+(\d+)$/, fnc: 'adminEvict' },
        // { reg: /^#耄耋机驱逐\s*\S+$/, fnc: 'adminEvict' },
        // { reg: /^#耄耋机解驱\s+(\d+)$/, fnc: 'adminUnEvict' },
        // { reg: /^#耄耋机解驱\s*\S+$/, fnc: 'adminUnEvict' },
        // { reg: /^#耄耋机对战/, fnc: 'duel' },
        // { reg: /^#耄耋机接受$/, fnc: 'duelAccept' },
        // { reg: /^#耄耋机拒绝$/, fnc: 'duelDecline' },
        { reg: /^#耄耋机冒险$/, fnc: 'advStart' },
        { reg: /^#冒险开始$/, fnc: 'advStart' },
        { reg: /^#冒险继续$/, fnc: 'advContinue' },
        { reg: /^#冒险下一步$/, fnc: 'advNextFloor' },
        { reg: /^#冒险撤退$/, fnc: 'advRetreat' },
        { reg: /^#冒险状态$/, fnc: 'advStatus' },
        { reg: /^#冒险排行$/, fnc: 'advRank' },
        { reg: /^[#＃]?攻\d+防\d+$/, fnc: 'advBossRoll' },
        { reg: /^[#＃]?全攻$/, fnc: 'advBossRollAllAtk' },
        { reg: /^[#＃]?全防$/, fnc: 'advBossRollAllDef' },
        { reg: /^#[选選][123]$/, fnc: 'advPickEvent' },
        { reg: /^#买\s+\d+/, fnc: 'advBuy' },
        { reg: /^#跳过$/, fnc: 'advSkipShop' },
        { reg: /^#继续冒险$/, fnc: 'advContinueLoop' },
        { reg: /^#撤离$/, fnc: 'advEndLoop' }
      ]
    })
  }

  async play (e) {
    return this.doSpin(e, DEFAULT_BET)
  }

  async playBet (e) {
    const m = e.msg.match(/^#耄耋机\s+(\d+)$/)
    let bet = parseInt(m[1]) || DEFAULT_BET
    if (bet < 10) bet = 10
    return this.doSpin(e, bet, false)
  }

  async doSpin (e, bet, useFree = true) {
    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)

    // 驱逐检查
    const evictions = data._evictions || {}
    const evictExpiry = evictions[uid]
    if (evictExpiry && Date.now() < evictExpiry) {
      const remain = Math.ceil((evictExpiry - Date.now()) / 60000)
      return e.reply(`🚫 你被管理员驱逐了，还要等 ${remain} 分钟才能下注！`)
    }
    if (evictExpiry && Date.now() >= evictExpiry) {
      delete evictions[uid]
      data._evictions = evictions
    }

    // 只有裸 #耄耋机 才触发免费转
    const isFree = useFree && player.freeSpins > 0
    if (isFree) bet = FREE_BET

    // 余额检查
    // 余额超过101万且有欠款，必须先还
    if (player.coins >= 1010000 && player.debt > 0) {
      return e.reply(
        `⚠️ 余额超过101万且有欠款，必须先还款才能继续！\n\n` +
        `💰 余额：${player.coins} 币\n` +
        `💳 欠款：${player.debt} 币\n\n` +
        `发送 #耄耋机还 <金额> 还款，还到余额低于101万即可继续\n` +
        `发 #耄耋机欠款 查看详情`
      )
    }

    if (!isFree && player.coins < bet) {
      if (player.coins < 1000) {
        const loan = Math.max(bet * 2, 10000)
        return e.reply(
          `💸 余额不足！你只有 ${player.coins} 币。\n\n` +
          `💰 余额：${player.coins} 币 | 💳 欠款：${player.debt} 币\n` +
          `发送 #耄耋机借 ${loan} 借 ${loan} 币继续玩（无利息）`
        )
      }
      return e.reply(`💸 余额不足！你只有 ${player.coins} 币，最低下注 ${DEFAULT_BET}。\n💳 当前欠款：${player.debt} 币，发 #耄耋机借 <金额> 借币。`)
    }

    if (isFree) player.freeSpins--
    else player.coins -= bet

    const reels = spin()
    const result = calcResult(reels, bet)

    let winAmount = result.payout
    let bonusNote = ''

    // 三只耄耋特殊处理：代币归零 + 欠款清零
    if (result.type === 'maodie') {
      player.coins = 0
      player.debt = 0
      player.streak = 0
    } else {
      // 连胜计算
      if (result.type !== 'bomb' && result.payout > 0) {
        player.streak++
        if (player.streak > player.bestStreak) player.bestStreak = player.streak
        const streakMulti = getStreakMulti(player.streak)
        if (streakMulti > 1) {
          winAmount = Math.floor(winAmount * streakMulti)
          bonusNote = streakMsg(player.streak)
        }
      } else {
        player.streak = 0
      }

      // 扣/加钱，余额不能为负
      player.coins += winAmount
      if (player.coins < 0) player.coins = 0
    }

    // 显示欠款状态
    let debtNote = ''
    if (player.debt > 0) {
      debtNote = `💳 欠款：${player.debt} 币（发 #耄耋机还 <金额> 还款）`
    }

    if (winAmount > player.biggestWin) player.biggestWin = winAmount
    if (winAmount > 0) player.totalWin += winAmount

    saveData(data)

    // 构建输出
    const freeNote = isFree ? `（免费转 ${player.freeSpins + 1}/${FREE_SPINS}）` : ''
    const allSyms = SYMBOLS.filter(s => s.emoji !== BOMB && s.emoji !== MAODIE).map(s => s.emoji)
    const randSym = () => allSyms[Math.floor(Math.random() * allSyms.length)]

    let resultLine = ''
    let flavorText = ''
    if (result.type === 'maodie') {
      resultLine = '🐱🐱🐱 三只耄耋！'
      flavorText = '代币归零！你把钱全输给耄耋了！'
    } else if (result.type === 'triple') {
      resultLine = `🎉 三个${result.sym.name}！${result.sym.multi}倍！`
      flavorText = result.sym.emoji === '7️⃣'
        ? '🏆 JACKPOT！！！'
        : `赢了 ${winAmount} 币！`
    } else if (result.type === 'double') {
      resultLine = `✌️ 两个相同！2倍！赢了 ${winAmount} 币`
    } else if (result.type === 'bomb') {
      const bombText = result.bombCount === 3 ? '💀 炸膛！' : result.bombCount === 2 ? '💥 双炸！' : '💣 中弹！'
      resultLine = `${bombText} 扣 ${Math.abs(winAmount)} 币`
      flavorText = result.bombCount === 3 ? '三个炸弹…今天别玩了' : '运气不太好…'
    } else {
      const missTexts = ['啥也没有，下次再来', '差一点点！', '手气一般般', '空转！']
      flavorText = missTexts[Math.floor(Math.random() * missTexts.length)]
    }

    const frame = (a, b, c) => [
      `🎰 耄耋机${freeNote}`,
      `下注：${bet} 币`,
      '',
      `${a}  ${b}  ${c}`
    ].join('\n')

    const finalMsg = [
      frame(reels[0].emoji, reels[1].emoji, reels[2].emoji),
      '',
      resultLine,
      flavorText,
      bonusNote,
      debtNote,
      `💰 余额：${player.coins} 币`
    ].filter(Boolean).join('\n')

    // 转发消息形式：3轮动画 + 最终结果
    const nickname = e.bot?.nickname || '机器人'
    const user_id = e.bot?.uin || e.self_id
    const msgList = [
      { message: frame(randSym(), randSym(), randSym()), nickname, user_id },
      { message: frame(reels[0].emoji, randSym(), randSym()), nickname, user_id },
      { message: frame(reels[0].emoji, reels[1].emoji, randSym()), nickname, user_id },
      { message: finalMsg, nickname, user_id }
    ]
    const sendForward = e.group?.sendForwardMsg || e.friend?.sendForwardMsg
    if (sendForward) return sendForward(msgList)
    return e.reply(finalMsg)
  }

  async leaderboard (e) {
    const data = loadData()
    const entries = Object.entries(data)
    if (!entries.length) return e.reply('🎰 还没人玩过耄耋机，发 #耄耋机 开始！')

    // 无负债排行
    const noDebt = entries.filter(([_, p]) => p.debt === 0).sort((a, b) => b[1].coins - a[1].coins).slice(0, 10)
    // 有负债排行
    const hasDebt = entries.filter(([_, p]) => p.debt > 0).sort((a, b) => b[1].debt - a[1].debt)
    // 连胜排行
    const byStreak = entries.filter(([_, p]) => p.bestStreak > 0).sort((a, b) => b[1].bestStreak - a[1].bestStreak).slice(0, 5)

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

    let msg = '🎰 耄耋机排行榜\n━━━━━━━━━━━━━━━\n'
    msg += '💰 持币排行（无负债）\n'
    noDebt.forEach(([uid, p], i) => {
      msg += `${medals[i]} ${uid} — ${p.coins} 币 🔥${p.bestStreak}连\n`
    })
    if (!noDebt.length) msg += '（无人上榜）\n'

    msg += '\n💳 欠款排行\n'
    hasDebt.slice(0, 10).forEach(([uid, p], i) => {
      msg += `${medals[i]} ${uid} — 欠 ${p.debt} 币 💰${p.coins}\n`
    })
    if (!hasDebt.length) msg += '（无人欠款）\n'

    msg += '\n🔥 最长连胜\n'
    byStreak.forEach(([uid, p], i) => {
      msg += `${medals[i]} ${uid} — ${p.bestStreak} 连\n`
    })
    if (!byStreak.length) msg += '（无人连胜）\n'

    return e.reply(msg.trim())
  }

  async borrow (e) {
    const m = e.msg.match(/^#耄耋机借\s*(\d+)$/)
    const amount = parseInt(m[1]) || 0
    if (amount < 1000) return e.reply('最低借1000币！')
    if (amount > 1000000) return e.reply('单次最多借100万币！')

    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)

    if (player.coins >= 100000) return e.reply(`💰 你有 ${player.coins} 币，超过10万，不需要借款！`)

    player.debt += amount
    player.coins += amount
    saveData(data)

    return e.reply(
      `💳 借款成功！\n\n` +
      `借出：${amount} 币\n` +
      `💰 余额：${player.coins} 币\n` +
      `💳 欠款：${player.debt} 币\n\n` +
      `⚠️ 余额超101万有欠款时无法下注，发 #耄耋机还 <金额> 还款`
    )
  }

  async repay (e) {
    const m = e.msg.match(/^#耄耋机还\s*(\d+)$/)
    const amount = parseInt(m[1]) || 0
    if (amount < 1) return e.reply('请输入还款金额！')

    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)

    if (player.debt <= 0) return e.reply('💳 你没有欠款，不用还！')
    if (amount > player.coins) return e.reply(`💸 余额不足！你只有 ${player.coins} 币，无法还 ${amount} 币。`)

    const repay = Math.min(amount, player.debt)
    player.coins -= repay
    player.debt -= repay
    saveData(data)

    return e.reply(
      `💳 还款成功！\n\n` +
      `还款：${repay} 币\n` +
      `💰 余额：${player.coins} 币\n` +
      `💳 剩余欠款：${player.debt} 币`
    )
  }

  async myDebt (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)
    return e.reply(
      `💳 你的欠款详情\n\n` +
      `💰 余额：${player.coins} 币\n` +
      `💳 欠款：${player.debt} 币\n` +
      `${player.coins > 0 && player.debt > 0 ? '赢钱会自动还债，加油！' : player.debt > 0 ? '余额不足还债，发 #耄耋机借 <金额> 借币' : '身无负债，清清爽爽！'}`
    )
  }

  async debtBoard (e) {
    const data = loadData()
    const entries = Object.entries(data).filter(([_, p]) => p.debt > 0)
    if (!entries.length) return e.reply('💳 目前没有人欠款，大家都是好孩子！')

    entries.sort((a, b) => b[1].debt - a[1].debt)
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
    let msg = '💳 欠款榜（欠最多的在前面）\n━━━━━━━━━━━━━━━\n'
    entries.slice(0, 10).forEach(([uid, p], i) => {
      msg += `${medals[i] || '  '} ${uid} — 欠 ${p.debt} 币\n`
    })
    return e.reply(msg.trim())
  }

  isAdmin (uid) {
    return ADMINS.includes(String(uid))
  }

  async adminClear (e) {
    if (!this.isAdmin(e.user_id)) return e.reply('⛔ 无权限！')
    const m = e.msg.match(/^#耄耋机清空\s+(\d+)$/)
    const target = m[1]
    const data = loadData()
    if (!data[target]) return e.reply(`用户 ${target} 没有玩过耄耋机`)
    data[target].coins = INIT_COINS
    data[target].debt = 0
    data[target].freeSpins = FREE_SPINS
    data[target].streak = 0
    saveData(data)
    return e.reply(`✅ 已清空用户 ${target}\n代币：${INIT_COINS} | 欠款：0 | 免费转：${FREE_SPINS}`)
  }

  async adminEvict (e) {
    if (!this.isAdmin(e.user_id)) return e.reply('⛔ 无权限！')
    let target
    const m = e.msg.match(/^#耄耋机驱逐\s+(\d+)$/)
    if (m) {
      target = m[1]
    } else if (e.at) {
      target = String(e.at)
    } else {
      return e.reply('用法：#耄耋机驱逐 @某人 或 #耄耋机驱逐 <QQ号>')
    }
    if (target === String(e.user_id)) return e.reply('😎 不能驱逐自己！')
    const data = loadData()
    if (!data[target]) return e.reply(`用户 ${target} 没有玩过耄耋机`)
    const evictions = data._evictions || {}
    evictions[target] = Date.now() + 10 * 60 * 1000 // 10分钟
    data._evictions = evictions
    saveData(data)
    return e.reply(`🚫 已驱逐用户 ${target}，10分钟内无法下注！`)
  }

  async adminUnEvict (e) {
    if (!this.isAdmin(e.user_id)) return e.reply('⛔ 无权限！')
    let target
    const m = e.msg.match(/^#耄耋机解驱\s+(\d+)$/)
    if (m) {
      target = m[1]
    } else if (e.at) {
      target = String(e.at)
    } else {
      return e.reply('用法：#耄耋机解驱 @某人 或 #耄耋机解驱 <QQ号>')
    }
    const data = loadData()
    const evictions = data._evictions || {}
    if (!evictions[target]) return e.reply(`用户 ${target} 没有被驱逐`)
    delete evictions[target]
    data._evictions = evictions
    saveData(data)
    return e.reply(`✅ 已解除用户 ${target} 的驱逐`)
  }

  async adminClearDebt (e) {
    if (!this.isAdmin(e.user_id)) return e.reply('⛔ 无权限！')
    const m = e.msg.match(/^#耄耋机还清\s+(\d+)$/)
    const target = m[1]
    const data = loadData()
    if (!data[target]) return e.reply(`用户 ${target} 没有玩过耄耋机`)
    const oldDebt = data[target].debt
    data[target].debt = 0
    saveData(data)
    return e.reply(`✅ 已清除用户 ${target} 的欠款\n原欠款：${oldDebt} 币 → 已清零`)
  }

  async myCoins (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)
    return e.reply(
      `🎰 耄耋机余额\n\n` +
      `💰 余额：${player.coins} 币\n` +
      `💳 欠款：${player.debt} 币\n` +
      `🎁 免费转：${player.freeSpins}/${FREE_SPINS}\n` +
      `🔥 当前连胜：${player.streak} 连\n` +
      `📊 最长连胜：${player.bestStreak} 连\n` +
      `🏆 累计赢币：${player.totalWin} 币\n` +
      `💎 单次最高：${player.biggestWin} 币`
    )
  }

  async features (e) {
    const nickname = e.bot?.nickname || '机器人'
    const user_id = e.bot?.uin || e.self_id
    const msgList = [
      {
        message: `🎰 耄耋机功能说明\n\n🎮 玩法：\n#耄耋机 —— 免费转（每日3次，固定5000）\n#耄耋机 10000 —— 下注10000币\n#耄耋机余额 —— 查看个人余额和状态`,
        nickname, user_id
      },
      {
        message: `📊 排行榜：\n#耄耋机排行 —— 持币/欠款/连胜排行\n\n💳 借贷：\n#耄耋机借 10000 —— 借10000币（无利息，单次最多100万）\n#耄耋机还 5000 —— 还款5000币\n#耄耋机欠款 —— 查看个人欠款\n#耄耋机欠款榜 —— 谁欠最多`,
        nickname, user_id
      },
      {
        message: `⛏️ 挖矿（免费，30秒冷却）：\n#耄耋机挖矿 —— 挖矿赚币\n💎 宝石=5万 | 🔥 火焰石=2万 | 💠 碎钻=1.5万 | ⭐ 星尘=1万\n🪨 煤炭=5千 | 🪙 金币=3千 | 🪹 空 | 🐱 耄耋=+100万清债`,
        nickname, user_id
      },
      {
        message: `🎰 符号赔率：\n🍒🍋🍊 三同=5倍 | 🔔⭐ 三同=10倍\n💎 三同=20倍 | 7️⃣ 三同=77倍（JACKPOT）\n💣 1个=1x扣 | 2个=1.5x扣 | 3个=2x扣\n🐱 三只耄耋=代币归零+清债\n\n⚡ 连胜倍率：2连×1.2 | 3连×1.5 | 5连×2\n⚠️ 余额超101万有欠款时无法下注，需先还款`,
        nickname, user_id
      },
      {
        message: `👑 管理员：\n#耄耋机清空 <QQ号> —— 清空用户数据\n#耄耋机还清 <QQ号> —— 清除用户欠款\n#耄耋机驱逐 <QQ号> —— 驱逐用户10分钟无法下注\n#耄耋机解驱 <QQ号> —— 解除用户驱逐\n\n⚔️ 对战：\n#耄耋机对战 @某人 <金额> —— 向某人发起对战\n#耄耋机接受 —— 接受对战邀请\n#耄耋机拒绝 —— 拒绝对战邀请\n双方各押注，随机数比大小，赢家通吃！2分钟过期`,
        nickname, user_id
      },
      {
        message: `🏔️ 大冒险（入场1万币，3层循环爬塔）：\n#耄耋机冒险 —— 开始冒险\n#冒险状态 —— 查看血量/骰子/诅咒\n#冒险撤退 —— 带走所有奖励安全退出\n#冒险排行 —— 冒险历史排行\n⚠️ 死亡 = 归零！诅咒每轮叠加，爬越高越难`,
        nickname, user_id
      }
    ]
    const sendForward = e.group?.sendForwardMsg || e.friend?.sendForwardMsg
    if (sendForward) return sendForward(msgList)
    return e.reply(msgList.map(m => m.message).join('\n\n'))
  }

  async mine (e) {
    const uid = String(e.user_id)
    const now = Date.now()
    const last = mineCooldown.get(uid) || 0
    if (now - last < MINE_CD) {
      const wait = Math.ceil((MINE_CD - (now - last)) / 1000)
      return e.reply(`⏳ 挖矿冷却中，还要等 ${wait} 秒`)
    }
    mineCooldown.set(uid, now)

    const data = loadData()
    const player = getPlayer(data, uid)

    // 随机挖矿结果
    const total = MINE_ITEMS.reduce((s, i) => s + i.weight, 0)
    let r = Math.random() * total
    let item = MINE_ITEMS[0]
    for (const mi of MINE_ITEMS) {
      r -= mi.weight
      if (r <= 0) { item = mi; break }
    }

    let resultLine = ''
    let flavorText = ''

    if (item.value > 0) {
      player.coins += item.value
      resultLine = `${item.emoji} 挖到${item.name}！+${item.value} 币！`
      flavorText = item.value >= 50000 ? '发财了！' : item.value >= 10000 ? '不错不错！' : '小赚一笔'
    } else if (item.name === '耄耋') {
      player.coins += item.value
      player.debt = 0
      resultLine = '🐱 挖到耄耋！+100万币！欠款清零！'
      flavorText = '耄耋赏你的'
    } else {
      resultLine = '🪹 啥也没挖到'
      flavorText = '换个地方试试'
    }

    saveData(data)

    const msg = [
      `⛏️ 耄耋机挖矿`,
      '',
      `${item.emoji} ${item.name}！`,
      resultLine,
      flavorText,
      `💰 余额：${player.coins} 币${player.debt > 0 ? ' | 💳 欠款：' + player.debt + ' 币' : ''}`
    ].filter(Boolean).join('\n')

    return e.reply(msg)
  }

  async duel (e) {
    const uid = String(e.user_id)
    let targetId, amount

    // 从消息末尾提取金额
    const amountMatch = e.msg.match(/(\d+)\s*$/)
    if (!amountMatch) return e.reply('用法：#耄耋机对战 @某人 <金额> 或 #耄耋机对战 <QQ号> <金额>')
    amount = parseInt(amountMatch[1]) || 0

    // 提取目标：优先用 e.at（@），否则用消息中的 QQ 号
    if (e.at) {
      targetId = String(e.at)
    } else {
      const numMatch = e.msg.match(/^#耄耋机对战\s+(\d+)/)
      if (numMatch) targetId = numMatch[1]
    }
    if (!targetId) return e.reply('用法：#耄耋机对战 @某人 <金额> 或 #耄耋机对战 <QQ号> <金额>')

    if (targetId === uid) return e.reply('😎 不能跟自己对战！')
    if (amount < 100) return e.reply('最低对战 100 币！')

    // 检查驱逐
    const data = loadData()
    const evictions = data._evictions || {}
    if (evictions[uid] && Date.now() < evictions[uid]) {
      const remain = Math.ceil((evictions[uid] - Date.now()) / 60000)
      return e.reply(`🚫 你被驱逐了，还要等 ${remain} 分钟！`)
    }
    if (evictions[targetId] && Date.now() < evictions[targetId]) {
      return e.reply(`🚫 对方被驱逐中，无法对战！`)
    }

    // 清理过期邀请
    for (const [k, v] of pendingDuels) {
      if (Date.now() > v.expiry) pendingDuels.delete(k)
    }

    // 检查是否已有pending
    if (pendingDuels.has(uid)) return e.reply('⚠️ 你已经有一个待回应的对战邀请，等对方回应或过期！')
    for (const [k, v] of pendingDuels) {
      if (v.targetId === uid) return e.reply('⚠️ 你已经收到一个对战邀请，先回应！发 #耄耋机接受 或 #耄耋机拒绝')
    }

    const player = getPlayer(data, uid)
    const target = getPlayer(data, targetId)

    if (player.coins < amount) return e.reply(`💸 余额不足！你只有 ${player.coins} 币，无法对战 ${amount} 币！`)
    if (target.coins < amount) return e.reply(`💸 对方余额不足！对方只有 ${target.coins} 币。`)

    pendingDuels.set(uid, { targetId, amount, expiry: Date.now() + DUEL_EXPIRE })

    const remainSec = Math.floor(DUEL_EXPIRE / 1000)
    // 用 segment.at 提醒被挑战者
    const atTarget = segment.at(targetId)
    return e.reply([
      atTarget,
      `⚔️ 对战邀请！\n\n` +
      `👤 ${uid} 向你发起对战\n` +
      `💰 对战金额：${amount} 币\n\n` +
      `发 #耄耋机接受 开战，#耄耋机拒绝 拒绝\n` +
      `⏰ ${remainSec} 秒内未回应自动取消`
    ])
  }

  async duelAccept (e) {
    const uid = String(e.user_id)
    const data = loadData()

    // 找到指向自己的邀请
    let challengerId = null
    let duelInfo = null
    for (const [k, v] of pendingDuels) {
      if (v.targetId === uid && Date.now() <= v.expiry) {
        challengerId = k
        duelInfo = v
        break
      }
    }
    if (!challengerId) return e.reply('⚠️ 没有待回应的对战邀请！')

    pendingDuels.delete(challengerId)

    // 再次检查余额和驱逐
    const evictions = data._evictions || {}
    if (evictions[uid] && Date.now() < evictions[uid]) {
      return e.reply('🚫 你被驱逐了，无法对战！')
    }
    if (evictions[challengerId] && Date.now() < evictions[challengerId]) {
      return e.reply('🚫 对方被驱逐了，对战取消！')
    }

    const player1 = getPlayer(data, challengerId)
    const player2 = getPlayer(data, uid)
    const amount = duelInfo.amount

    if (player1.coins < amount) return e.reply(`💸 对方余额不足（${player1.coins} 币），对战取消！`)
    if (player2.coins < amount) return e.reply(`💸 余额不足（${player2.coins} 币），对战取消！`)

    // 扣款
    player1.coins -= amount
    player2.coins -= amount

    // 随机数对决
    const num1 = Math.floor(Math.random() * 100) + 1
    const num2 = Math.floor(Math.random() * 100) + 1
    const total = amount * 2

    let resultMsg
    if (num1 > num2) {
      player1.coins += total
      resultMsg =
        `⚔️ 对战结果\n\n` +
        `👤 ${challengerId}：🎲 ${num1}\n` +
        `👤 ${uid}：🎲 ${num2}\n\n` +
        `🎉 ${challengerId} 获胜！赢得 ${total} 币！\n\n` +
        `💰 ${challengerId} 余额：${player1.coins} 币\n` +
        `💰 ${uid} 余额：${player2.coins} 币`
    } else if (num2 > num1) {
      player2.coins += total
      resultMsg =
        `⚔️ 对战结果\n\n` +
        `👤 ${challengerId}：🎲 ${num1}\n` +
        `👤 ${uid}：🎲 ${num2}\n\n` +
        `🎉 ${uid} 获胜！赢得 ${total} 币！\n\n` +
        `💰 ${challengerId} 余额：${player1.coins} 币\n` +
        `💰 ${uid} 余额：${player2.coins} 币`
    } else {
      // 平局退币
      player1.coins += amount
      player2.coins += amount
      resultMsg =
        `⚔️ 对战结果\n\n` +
        `👤 ${challengerId}：🎲 ${num1}\n` +
        `👤 ${uid}：🎲 ${num2}\n\n` +
        `🤝 平局！双方各退回 ${amount} 币`
    }

    saveData(data)
    return e.reply(resultMsg)
  }

  async duelDecline (e) {
    const uid = String(e.user_id)
    let challengerId = null
    for (const [k, v] of pendingDuels) {
      if (v.targetId === uid && Date.now() <= v.expiry) {
        challengerId = k
        break
      }
    }
    if (!challengerId) return e.reply('⚠️ 没有待回应的对战邀请！')
    pendingDuels.delete(challengerId)
    return e.reply(`🏳️ ${uid} 拒绝了对战邀请！`)
  }

  // ========== 大冒险 ==========
  _getAdv (data, uid) {
    return data._adventure?.[uid] || null
  }
  _setAdv (data, uid, state) {
    const d = data || loadData()
    if (!d._adventure) d._adventure = {}
    d._adventure[uid] = state
    saveData(d)
  }
  _clearAdv (data, uid) {
    if (data._adventure) delete data._adventure[uid]
  }
  _newAdvState () {
    return {
      hp: ADV_INIT_HP, maxHp: ADV_INIT_HP, attack: 0,
      dice: 6, diceBonus: 0, critBonus: 0, shopBought: 0, funBought: 0, boughtItems: [],
      shield: 0, dmgReduce: 0, thorns: 0, lifesteal: 0,
      revives: 0, maodieEye: false, luckyClover: false,
      gamblerHeart: false, thiefGlove: false, maodieBless: false,
      curses: [], loop: 1,
      floor: 1, earnings: 0, totalEarnings: 0,
      boss: null, bossTurn: 0, nextDouble: false,
      startedAt: Date.now()
    }
  }
  _genBoss (loop) {
    const hpMult = loop - 1
    const baseHp = 120 + hpMult * 80
    const baseAtk = 0 + hpMult * 15
    const pattern = []
    // 普通招式池（不含大招）
    const normalPatterns = ADV_BOSS_PATTERNS.filter(p => p.type !== 'ultimate')
    for (let i = 0; i < 3; i++) {
      // 5%概率出大招
      if (Math.random() < 0.05) {
        const ult = ADV_BOSS_PATTERNS.find(p => p.type === 'ultimate')
        pattern.push({ ...ult, dmg: ult.baseDmg + baseAtk })
      } else {
        const t = normalPatterns[randInt(0, normalPatterns.length - 1)]
        pattern.push({ ...t, dmg: t.baseDmg + baseAtk })
      }
    }
    // 第一回合强制有攻击（不允许全是蓄力/无伤害）
    if (pattern[0].dmg <= 0) {
      const slash = { ...ADV_BOSS_PATTERNS[0], dmg: ADV_BOSS_PATTERNS[0].baseDmg + baseAtk }
      pattern[0] = slash
    }
    const bossIdx = Math.min(loop - 1, ADV_BOSS_NAMES.length - 1)
    const bossName = ADV_BOSS_NAMES[bossIdx]
    const effects = [
      { id: 'regen', name: '远古之壳', desc: '每回合回复10HP' },
      { id: 'rage', name: '暴怒', desc: '每回合攻击+5（持续叠加）' },
      { id: 'shadow', name: '暗影潜行', desc: '每3回合闪避一次攻击' },
      { id: 'berserk', name: '狂暴', desc: '血量低于50%时攻击翻倍' },
      { id: 'unknown', name: '未知', desc: '每回合随机触发其他Boss效果' },
      { id: 'drain', name: '堕落之血', desc: '每回合吸走玩家5%当前血量' },
      { id: 'freeze', name: '冰冻', desc: '每2回合冻结玩家1颗骰子' },
      { id: 'burn', name: '烈焰', desc: '攻击附带灼烧，下回合额外扣10血' },
      { id: 'thunder', name: '雷霆', desc: '每回合30%概率雷击，无视防御扣25血' },
      { id: 'void', name: '虚空', desc: '每回合永久禁用玩家1个道具效果' }
    ]
    const effect = effects[bossIdx]
    return { name: bossName, hp: baseHp, maxHp: baseHp, pattern, turn: 0, chargeNext: false, effect, effectState: {} }
  }
  _getAvailableCurses (loop) {
    const maxTier = loop >= 4 ? 3 : loop >= 3 ? 2 : 1
    return ADV_CURSES.filter(c => c.tier <= maxTier)
  }
  _applyShopDiscount (adv, price) {
    if (adv.curses.includes('greed')) return Math.floor(price * 1.3)
    return price
  }

  async advStart (e) {
    const uid = String(e.user_id)
    const data = loadData()

    if (this._getAdv(data, uid)) {
      return e.reply('⚠️ 你已经有一场冒险进行中！发 #冒险状态 查看，#冒险撤退 放弃')
    }

    const evictions = data._evictions || {}
    if (evictions[uid] && Date.now() < evictions[uid]) {
      return e.reply('🚫 你被驱逐了，无法冒险！')
    }

    const player = getPlayer(data, uid)
    if (player.coins < ADV_FEE) {
      return e.reply(`💸 入场费 ${ADV_FEE} 币，你只有 ${player.coins} 币！`)
    }

    player.coins -= ADV_FEE
    const state = this._newAdvState()
    this._setAdv(data, uid, state)
    saveData(data)

    return this._showEvent(e, state)
  }

  _showEvent (e, state) {
    const total = ADV_EVENTS.reduce((s, ev) => s + ev.weight, 0)
    const picked = []
    while (picked.length < 3) {
      let r = Math.random() * total
      for (const ev of ADV_EVENTS) {
        r -= ev.weight
        if (r <= 0) { picked.push(ev); break }
      }
      if (picked.length < 3 && picked[picked.length - 1] === picked[picked.length - 2]) picked.pop()
    }
    state._eventChoices = picked.map(ev => ev.id)
    this._setAdv(loadData(), String(e.user_id), state)

    let msg = `🏔️ 大冒险 第${state.loop}轮 — 第1层：随机事件\n\n`
    picked.forEach((ev, i) => {
      msg += `${i + 1}️⃣ ${ev.name}\n`
    })
    msg += `\n🎲 回复 #选1 / #选2 / #选3 选择一个事件`
    return e.reply(msg)
  }

  async _applyEvent (e, state, eventId) {
    const uid = String(e.user_id)
    const data = loadData()
    const player = getPlayer(data, uid)
    let msg = ''

    switch (eventId) {
      case 'blessDice':
        state.dice += 3
        state.maxHp -= 10
        if (state.hp > state.maxHp) state.hp = state.maxHp
        msg = '🎲 一阵金光闪过，骰子袋里多了3颗骰子！但你的生命力被抽取了……+3骰子，最大血量-10'
        break
      case 'curseDice':
        state.dice = Math.max(1, state.dice - 2)
        player.coins += 30000
        msg = '🌀 贪婪之心！你的心被金币填满，两颗骰子化为灰烬……-2骰子，+30000币'
        break
      case 'sharpEye':
        state._sharpEye = true
        state._sharpEyeTurns = 2
        state.dmgReduce -= 10
        msg = '🎲 你闭上眼，Boss的前两招在脑海中清晰浮现……前2回合攻击×2，但防御变得脆弱（减伤-10）'
        break
      case 'ageCurse':
        state.diceBonus -= 2
        state.attack += 8
        msg = '💎 玻璃碎片嵌入你的骰子！点数-2，但碎片让你的拳头更锋利（攻击+8）'
        break
      case 'lifeHeart':
        state.maxHp += 30
        state.hp += 30
        state.dice = Math.max(1, state.dice - 1)
        msg = `❤️ 一颗跳动的心脏从石台上浮起，融入你的胸膛。+30血上限+30血，但骰子-1（${state.hp}/${state.maxHp}）`
        break
      case 'bloodRitual':
        state.hp -= 35
        state.attack += 5
        msg = `❤️ 血红色的法阵亮起，你感到一阵剧痛……-35血，但攻击+5（HP:${state.hp}/${state.maxHp}）`
        break
      case 'mushroom': {
        if (Math.random() < 0.5) {
          state.maxHp += 15
          state.hp += 30
          msg = `❤️ 你咬了一口发光的蘑菇……味道不错！+30血+15血上限（${state.hp}/${state.maxHp}）`
        } else {
          state.hp -= 30
          msg = `❤️ 你咬了一口发光的蘑菇……呕！有毒！-30血（HP:${state.hp}/${state.maxHp}）`
        }
        break
      }
      case 'strPotion':
        state.attack += 4
        state.dmgReduce -= 2
        msg = '⚔️ 一瓶冒着热气的药水，喝下去浑身充满力量。攻击+4，但防御变弱（减伤-2）'
        break
      case 'battleAwake':
        state.attack += 6
        state.dmgReduce -= 3
        state.dice += 1
        msg = '⚔️ 战意觉醒！前所未有的战意涌来，攻击+6，骰子+1，但防御变得脆弱（减伤-3）'
        break
      case 'weakPoint':
        state._bossAtkUp = (state._bossAtkUp || 0) + 3
        state.attack += 3
        msg = '⚔️ 你发现了Boss的弱点！攻击+3，但Boss被激怒了（攻击+3）'
        break
      case 'shieldShard':
        state.shield += 2
        state.attack -= 2
        msg = '🛡️ 碎片拼凑成两面护盾！+2护盾，但攻击-2'
        break
      case 'ironWall':
        state.dmgReduce += 5
        state.dice = Math.max(1, state.dice - 1)
        msg = '🛡️ 铁壁祝福！铁甲覆盖全身，减伤+5，但骰子-1'
        break
      case 'thornArmor':
        state.thorns += 10
        state.maxHp -= 15
        if (state.hp > state.maxHp) state.hp = state.maxHp
        msg = '🛡️ 荆棘之甲！浑身长满尖刺，反弹10伤害，但身体变得脆弱（最大血量-15）'
        break
      case 'treasure': {
        if (Math.random() < 0.7) {
          const coin = randInt(10000, 40000)
          state.earnings += coin
          msg = `🌀 宝箱缓缓打开……里面堆满了金币！获得 ${coin} 币`
        } else {
          state.hp -= 25
          msg = `🌀 宝箱打开的瞬间，一支暗箭射出！-25血（HP:${state.hp}/${state.maxHp}）`
        }
        break
      }
      case 'gamble': {
        if (player.coins < 5000) {
          msg = '🌀 赌石摊主看了你一眼：「没钱就别来赌。」（需要5000币）'
        } else {
          player.coins -= 5000
          if (Math.random() < 0.5) {
            player.coins += 30000
            msg = '🌀 你一刀切下……帝王绿！-5000币，+30000币！赌石大涨！'
          } else {
            player.coins -= 5000
            msg = '🌀 你一刀切下……什么都没有。-10000币，血本无归。'
          }
        }
        break
      }
      case 'merchant': {
        const effects = [
          () => { state.attack += 3; return '攻击+3' },
          () => { state.dice += 2; return '骰子+2' },
          () => { state.shield += 2; return '护盾+2' },
          () => { state.dmgReduce += 5; return '减伤+5' },
          () => { state.hp = Math.min(state.maxHp, state.hp + 30); return '回复30血' }
        ]
        const eff = effects[randInt(0, effects.length - 1)]()
        state.hp -= 10
        msg = `🌀 一个神秘商人从暗处走出：「这个给你，算交个朋友。」获得 ${eff}，但商人顺手偷了你10血`
        break
      }
      case 'greedDoor':
        state.earnings += 40000
        state._bossAtkUp = (state._bossAtkUp || 0) + 8
        msg = '🌀 贪婪之门！金币如雨落下（+40000币），但门后传来一声怒吼……Boss被激怒了（攻击+8）'
        break
      case 'curseBox': {
        const effects = [
          () => { state.attack += 5; return '攻击+5' },
          () => { state.dice += 2; return '骰子+2' },
          () => { state.shield += 2; return '护盾+2' },
          () => { state.dmgReduce += 8; return '减伤+8' }
        ]
        const eff = effects[randInt(0, effects.length - 1)]()
        state._bossAtkUp = (state._bossAtkUp || 0) + 8
        msg = `🌀 恶魔契约！恶魔现身：「签了它，力量归你。」获得 ${eff}，但恶魔的力量涌入Boss体内（攻击+8）`
        break
      }
    }

    if (state.hp <= 0) {
      state.hp = 0
      this._clearAdv(data, uid)
      saveData(data)
      return e.reply(msg + `\n\n💀 你倒下了…所有收益清零！`)
    }

    state.floor = 2
    state.shopBought = 0
    state.funBought = 0
    this._setAdv(data, uid, state)
    saveData(data)

    // 发事件结果
    await e.reply(msg)
    // 发商店
    const shopMsg = this._buildShopMsg(state, getPlayer(data, uid))
    return e.reply(shopMsg)
  }

  async advContinue (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state) return e.reply('⚠️ 你没有进行中的冒险！发 #耄耋机冒险 开始')

    if (state.floor === 1) return this._showEvent(e, state)
    if (state.floor === 2) return this._showShop(e, state)
    if (state.floor === 3) return e.reply(this._setupBoss(e, state))
    return e.reply('⚠️ 未知状态，请 #冒险撤退 重新开始')
  }

  async advNextFloor (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state) return e.reply('⚠️ 你没有进行中的冒险！')
    if (state.floor === 2) {
      state.floor = 3
      this._setAdv(data, uid, state)
      saveData(data)
      return e.reply(this._setupBoss(e, state))
    }
    return e.reply('⚠️ 当前不能跳过，请 #冒险继续')
  }

  async advPickEvent (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 1) return e.reply('⚠️ 当前不是事件层！')

    const m = e.msg.match(/[123]/)
    if (!m) return e.reply('请选择 1/2/3')
    const idx = parseInt(m[0]) - 1
    const choices = state._eventChoices || []
    if (idx < 0 || idx >= choices.length) return e.reply('无效选择')

    return this._applyEvent(e, state, choices[idx])
  }

  _buildShopMsg (state, player) {
    const cc = state.curses || []
    const discount = cc.includes('greed')
    let msg = `🏪 商店（第${state.loop}轮）\n`
    if (discount) msg += `⚠️ 贪婪诅咒：价格+30%\n`
    msg += `💰 余额：${player.coins} 币\n\n`
    const cats = { '❤️': [], '⚔️': [], '🎲': [], '🛡️': [], '✨': [] }
    ADV_SHOP.forEach((item, i) => {
      const price = discount ? Math.floor(item.price * 1.3) : item.price
      cats[item.cat].push(`${i + 1}. ${item.name} — ${price}币（${item.desc}）`)
    })
    for (const [cat, items] of Object.entries(cats)) {
      if (items.length) msg += `${cat}\n${items.join('\n')}\n\n`
    }
    msg += `🏪 回复 #买 <编号> 购买（如 #买 1 5 7）\n每轮最多买3个，✨趣味道具限1个，#跳过 进入Boss战`
    return msg
  }

  _showShop (e, state) {
    const uid = String(e.user_id)
    const data = loadData()
    state.shopBought = 0
    state.funBought = 0
    const player = getPlayer(data, uid)
    const msg = this._buildShopMsg(state, player)
    this._setAdv(data, uid, state)
    saveData(data)
    return e.reply(msg)
  }

  async advBuy (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 2) return e.reply('⚠️ 当前不是商店层！')

    const nums = e.msg.match(/\d+/g)
    if (!nums) return e.reply('用法：#买 <编号>（如 #买 1 5 7）')

    const player = getPlayer(data, uid)
    const bought = []
    const failed = []
    const maxBuy = 3
    let remaining = maxBuy - (state.shopBought || 0)

    for (const n of nums) {
      if (remaining <= 0) { failed.push('已达购买上限（每轮最多3个）'); break }
      const idx = parseInt(n) - 1
      if (idx < 0 || idx >= ADV_SHOP.length) { failed.push(`#${n}无效`); continue }
      const item = ADV_SHOP[idx]
      if ((state.boughtItems || []).includes(item.id)) { failed.push(`${item.name}已购买`); continue }
      if (item.cat === '✨' && (state.funBought || 0) >= 1) { failed.push(`趣味道具每轮限买1个`); continue }
      const price = this._applyShopDiscount(state, item.price)
      if (player.coins < price) { failed.push(`${item.name}余额不足`); continue }
      player.coins -= price
      state.shopBought = (state.shopBought || 0) + 1
      if (item.cat === '✨') state.funBought = (state.funBought || 0) + 1
      state.boughtItems = state.boughtItems || []
      state.boughtItems.push(item.id)
      remaining--
      bought.push(item.name)

      // 直接生效
      switch (item.id) {
        case 'potion': state.hp = Math.min(state.maxHp, state.hp + 30); break
        case 'bigPotion': state.hp = Math.min(state.maxHp, state.hp + 60); break
        case 'lifeHeart': state.maxHp += 20; state.hp += 20; break
        case 'revive': state.revives = (state.revives || 0) + 1; break
        case 'atkPotion': state.attack += 3; break
        case 'mastery': state.attack += 5; break
        case 'critNecklace': state.critBonus = (state.critBonus || 0) + 0.1; break
        case 'diceBag': state.dice += 1; break
        case 'luckyDice': state.diceBonus = (state.diceBonus || 0) + 1; break
        case 'shield': state.shield += 1; break
        case 'ironWall': state.dmgReduce += 5; break
        case 'thorns': state.thorns += 10; break
        case 'lifesteal': state.lifesteal += 0.1; break
        case 'maodieEye': state.maodieEye = true; state._bossAtkUp = (state._bossAtkUp || 0) + 5; break
        case 'luckyClover': state.luckyClover = true; state.critBonus = (state.critBonus || 0) - 0.1; break
        case 'gamblerHeart': state.gamblerHeart = true; break
        case 'maodieBless': state.maodieBless = true; state.maxHp -= 20; if (state.hp > state.maxHp) state.hp = state.maxHp; break
        case 'thiefGlove': state.thiefGlove = true; break
      }
    }

    this._setAdv(data, uid, state)
    saveData(data)

    let resultMsg = ''
    if (bought.length) resultMsg += `✅ 购买：${bought.join('、')}\n`
    if (failed.length) resultMsg += `❌ 失败：${failed.join('、')}\n`
    resultMsg += `💰 余额：${player.coins} 币`

    // 买完自动进入Boss战
    state.floor = 3
    this._setAdv(data, uid, state)
    saveData(data)
    const bossMsg = this._setupBoss(e, state)
    return e.reply(resultMsg + '\n\n' + bossMsg)
  }

  async advSkipShop (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 2) return e.reply('⚠️ 当前不是商店层！')

    state.floor = 3
    this._setAdv(data, uid, state)
    saveData(data)
    return e.reply(this._setupBoss(e, state))
  }

  _setupBoss (e, state) {
    const uid = String(e.user_id)
    const data = loadData()
    const boss = this._genBoss(state.loop)
    if (state._bossAtkUp) boss.pattern.forEach(p => { p.dmg += state._bossAtkUp })
    state.boss = boss
    state.bossTurn = 0
    state.floor = 3
    this._setAdv(data, uid, state)
    saveData(data)

    const cc = state.curses || []
    const fog = cc.includes('fog')

    let msg = `🐲 Boss：${boss.name} ❤️ ${boss.hp}/${boss.maxHp}\n`
    msg += `🌀 专属效果：${boss.effect.desc}\n\n`
    msg += `你的状态：❤️ ${state.hp}/${state.maxHp} | ⚔️+${state.attack} | 🎲 ${state.dice}颗`
    if (state.shield) msg += ` | 🛡️×${state.shield}`
    if (state.dmgReduce) msg += ` | 减伤${state.dmgReduce}`
    if (state.maodieEye) {
      msg += `\n\n👁️ 耄耋之眼 - 出招表：\n`
      boss.pattern.forEach((p, i) => {
        msg += `🔮 ${i === 0 ? '本回合' : '第' + (i + 1) + '回合'}Boss行动：${p.desc}（${p.dmg}伤害）\n`
      })
    } else {
      msg += `\n\n🔮 本回合Boss行动：${boss.pattern[0].desc}（${boss.pattern[0].dmg}伤害）`
    }
    msg += `\n\n🐲 输入 #攻X防Y 分配骰子（如 #攻7防3 = 7颗攻击+3颗防御，共${state.dice}颗）\n`
    msg += `或 全攻 / 全防`
    return msg
  }

  async advBossRoll (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 3 || !state.boss) return e.reply('⚠️ 当前不是Boss战！')

    const m = e.msg.match(/#攻(\d+)防(\d+)/)
    if (!m) return e.reply('格式：#攻X防Y（如 #攻7防3 = 7颗攻击3颗防御）')

    const atkDice = parseInt(m[1])
    const defDice = parseInt(m[2])
    const totalDice = state.dice

    if (atkDice + defDice !== totalDice) return e.reply(`骰子总数不对！你有 ${totalDice} 颗，攻${atkDice}+防${defDice}=${atkDice + defDice}`)
    if (atkDice < 0 || defDice < 0) return e.reply('骰子数不能为负！')

    // 契约诅咒检查
    const cc = state.curses || []
    if (cc.includes('pact')) {
      // 骰子下限-15（在rollDice里处理）
    }

    const diceMax = state.gamblerHeart ? 30 : 20
    const diceBonusTotal = (state.diceBonus || 0) + (state.maodieBless ? 5 : 0)
    let atkResults = rollDice(atkDice, diceBonusTotal, diceMax)
    let defResults = rollDice(defDice, diceBonusTotal, diceMax)
    // 契约诅咒：骰子下限-15
    if (cc.includes('pact')) {
      atkResults = atkResults.map(v => Math.max(-15, v))
      defResults = defResults.map(v => Math.max(-15, v))
    }
    const atkPts = atkResults.reduce((s, v) => s + v, 0)
    const defPts = defResults.reduce((s, v) => s + v, 0)
    const allResults = [...atkResults, ...defResults]

    return this._resolveBossTurn(e, state, uid, data, totalDice, atkPts, defPts, allResults)
  }

  async advBossRollAllAtk (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 3 || !state.boss) return e.reply('⚠️ 当前不是Boss战！')

    const cc = state.curses || []
    const diceMax = state.gamblerHeart ? 30 : 20
    const diceBonusTotal = (state.diceBonus || 0) + (state.maodieBless ? 5 : 0)
    let results = rollDice(state.dice, diceBonusTotal, diceMax)
    if (cc.includes('pact')) results = results.map(v => Math.max(-15, v))
    const total = results.reduce((s, v) => s + v, 0)
    return this._resolveBossTurn(e, state, uid, data, state.dice, total, 0, results)
  }

  async advBossRollAllDef (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.floor !== 3 || !state.boss) return e.reply('⚠️ 当前不是Boss战！')

    const cc = state.curses || []
    const diceMax = state.gamblerHeart ? 30 : 20
    const diceBonusTotal = (state.diceBonus || 0) + (state.maodieBless ? 5 : 0)
    let results = rollDice(state.dice, diceBonusTotal, diceMax)
    if (cc.includes('pact')) results = results.map(v => Math.max(-15, v))
    const total = results.reduce((s, v) => s + v, 0)
    return this._resolveBossTurn(e, state, uid, data, state.dice, 0, total, results)
  }

  _resolveBossTurn (e, state, uid, data, diceCount, atkPts, defPts, forcedResults) {
    const boss = state.boss
    const cc = state.curses || []

    // Roll dice
    const results = forcedResults || rollDice(diceCount, state.diceBonus)
    const total = results.reduce((s, v) => s + v, 0)

    if (atkPts + defPts !== total && !forcedResults) {
      return e.reply(`点数分配不对！骰了 ${total} 点，但攻${atkPts}+防${defPts}=${atkPts + defPts}`)
    }
    if (atkPts < 0 || defPts < 0) return e.reply('点数不能为负！')

    // 处理上回合效果
    let loseDiceMsg = ''
    if (state._loseDiceNext) {
      state.dice = Math.max(1, state.dice - state._loseDiceNext)
      loseDiceMsg = `⚔️ 劈砍效果：骰子-${state._loseDiceNext}颗（剩余${state.dice}颗）\n`
      state._loseDiceNext = 0
    }

    // Boss turn
    const turnIdx = state.bossTurn % boss.pattern.length
    let bossAtk = boss.pattern[turnIdx]
    let bossDmg = bossAtk.dmg

    // Boss空过（上回合大招）
    let bossSkip = false
    if (boss.skipNext) {
      bossSkip = true
      boss.skipNext = false
      bossDmg = 0
    }

    // Boss虚弱（上回合重击）
    if (boss.weakNext) {
      bossDmg = Math.max(0, bossDmg - 20)
      boss.weakNext = false
    }

    // 嘲弄诅咒：蓄力改为攻击
    if (cc.includes('mock') && bossAtk.type === 'charge') {
      bossDmg = 25 + (state.loop - 1) * 5
      bossAtk = { ...bossAtk, name: '蓄力→攻击', desc: '🛡️→⚔️ 蓄力改为攻击' }
    }

    // ============ Boss专属效果 ============
    let bossEffectMsg = ''
    const effectId = boss.effect?.id
    const es = boss.effectState || {}

    // 远古之壳：每回合回复10HP
    if (effectId === 'regen') {
      boss.hp = Math.min(boss.maxHp, boss.hp + 10)
      bossEffectMsg = `🐢 远古之壳：Boss回复10HP（${boss.hp}/${boss.maxHp}）`
    }

    // 暴怒：每回合攻击+5（叠加）
    if (effectId === 'rage') {
      es.rageStack = (es.rageStack || 0) + 5
      bossDmg += es.rageStack
      bossEffectMsg = `🔥 暴怒叠加：Boss攻击+${es.rageStack}`
    }

    // 暗影潜行：每3回合闪避一次
    if (effectId === 'shadow') {
      es.shadowTurn = (es.shadowTurn || 0) + 1
      if (es.shadowTurn % 3 === 0) {
        es.shadowDodge = true
        bossEffectMsg = `🌑 暗影潜行：Boss进入暗影！本回合攻击无效！`
      } else {
        bossEffectMsg = `🌑 暗影潜行：未触发（每3回合触发，下次Turn ${es.shadowTurn + (3 - es.shadowTurn % 3)}）`
      }
    }

    // 狂暴：血量低于50%时攻击翻倍
    if (effectId === 'berserk') {
      if (boss.hp <= boss.maxHp * 0.5) {
        bossDmg *= 2
        bossEffectMsg = `💢 狂暴！Boss血量低于50%，攻击翻倍！`
      } else {
        bossEffectMsg = `💢 狂暴：未触发（血量低于50%时激活）`
      }
    }

    // 未知：每回合随机触发其他Boss效果
    if (effectId === 'unknown') {
      const randomEffects = ['regen', 'rage', 'berserk', 'burn', 'thunder']
      const rEff = randomEffects[randInt(0, randomEffects.length - 1)]
      if (rEff === 'regen') {
        boss.hp = Math.min(boss.maxHp, boss.hp + 10)
        bossEffectMsg = `❓ 未知效果：远古之壳！Boss回复10HP`
      } else if (rEff === 'rage') {
        bossDmg += 10
        bossEffectMsg = `❓ 未知效果：暴怒！Boss攻击+10`
      } else if (rEff === 'berserk' && boss.hp <= boss.maxHp * 0.5) {
        bossDmg *= 2
        bossEffectMsg = `❓ 未知效果：狂暴！攻击翻倍！`
      } else if (rEff === 'burn') {
        state._burnDmg = (state._burnDmg || 0) + 10
        bossEffectMsg = `❓ 未知效果：烈焰！下回合额外扣10血`
      } else if (rEff === 'thunder') {
        if (Math.random() < 0.5) {
          state.hp -= 25
          bossEffectMsg = `❓ 未知效果：雷霆！无视防御扣25血！`
        } else {
          bossEffectMsg = `❓ 未知效果：雷霆！未触发`
        }
      } else {
        bossEffectMsg = `❓ 未知效果：${rEff}（未触发）`
      }
    }

    // 堕落之血：每回合吸走玩家5%当前血量
    if (effectId === 'drain') {
      const drainAmt = Math.max(1, Math.floor(state.hp * 0.05))
      state.hp -= drainAmt
      boss.hp = Math.min(boss.maxHp, boss.hp + drainAmt)
      bossEffectMsg = `🩸 堕落之血：吸走你${drainAmt}血（Boss+${drainAmt}HP）`
    }

    // 冰冻：每2回合冻结1颗骰子
    if (effectId === 'freeze') {
      es.freezeTurn = (es.freezeTurn || 0) + 1
      if (es.freezeTurn % 2 === 0) {
        state._frozenDice = (state._frozenDice || 0) + 1
        bossEffectMsg = `❄️ 冰冻：冻结你1颗骰子！（已冻结${state._frozenDice}颗）`
      } else {
        bossEffectMsg = `❄️ 冰冻：未触发（每2回合触发，下次Turn ${es.freezeTurn + (2 - es.freezeTurn % 2)}）`
      }
    }

    // 烈焰：攻击附带灼烧
    if (effectId === 'burn') {
      state._burnDmg = (state._burnDmg || 0) + 10
      bossEffectMsg = `🔥 烈焰灼烧：下回合额外扣${state._burnDmg}血`
    }

    // 雷霆：30%概率雷击
    if (effectId === 'thunder') {
      if (Math.random() < 0.3) {
        state.hp -= 25
        bossEffectMsg = `⚡ 雷霆一击！无视防御直接扣25血！`
      } else {
        bossEffectMsg = `⚡ 雷霆：未触发（30%概率）`
      }
    }

    // 虚空：永久禁用1个道具
    if (effectId === 'void') {
      const disableable = []
      if (state.shield > 0) disableable.push({ id: 'shield', name: '护盾' })
      if (state.thorns > 0) disableable.push({ id: 'thorns', name: '反甲' })
      if (state.dmgReduce > 0) disableable.push({ id: 'dmgReduce', name: '铁壁' })
      if (state.lifesteal > 0) disableable.push({ id: 'lifesteal', name: '吸血' })
      if ((state.critBonus || 0) > 0) disableable.push({ id: 'critBonus', name: '暴击项链' })
      if (state.maodieEye) disableable.push({ id: 'maodieEye', name: '耄耋之眼' })
      if (state.luckyClover) disableable.push({ id: 'luckyClover', name: '幸运草' })
      if (state.gamblerHeart) disableable.push({ id: 'gamblerHeart', name: '赌徒之心' })
      if (state.maodieBless) disableable.push({ id: 'maodieBless', name: '耄耋祝福' })
      if (state.thiefGlove) disableable.push({ id: 'thiefGlove', name: '偷窃手套' })
      state._disabledItems = state._disabledItems || []
      const available = disableable.filter(d => !state._disabledItems.includes(d.id))
      if (available.length > 0) {
        const stolen = available[randInt(0, available.length - 1)]
        state._disabledItems.push(stolen.id)
        // 禁用效果
        switch (stolen.id) {
          case 'shield': state.shield = 0; break
          case 'thorns': state.thorns = 0; break
          case 'dmgReduce': state.dmgReduce = 0; break
          case 'lifesteal': state.lifesteal = 0; break
          case 'critBonus': state.critBonus = 0; break
          case 'maodieEye': state.maodieEye = false; break
          case 'luckyClover': state.luckyClover = false; break
          case 'gamblerHeart': state.gamblerHeart = false; break
          case 'maodieBless': state.maodieBless = false; break
          case 'thiefGlove': state.thiefGlove = false; break
        }
        bossEffectMsg = `🌀 虚空吞噬：你的「${stolen.name}」被永久禁用！`
      } else {
        bossEffectMsg = `🌀 虚空吞噬：没有可禁用的道具了`
      }
    }

    boss.effectState = es

    // 蓄力加倍
    if (boss.chargeNext) {
      bossDmg *= 2
      boss.chargeNext = false
    }
    if (bossAtk.type === 'charge') boss.chargeNext = true

    // 嘲讽诅咒：Boss每回合+5
    if (cc.includes('taunt')) bossDmg += 5

    // 淬毒诅咒：被打额外+5
    if (cc.includes('toxic') && bossDmg > 0) bossDmg += 5

    // 冰冻骰子效果
    if (state._frozenDice && state._frozenDice > 0) {
      // 冻结的骰子不参与攻击（减少攻击点数）
      const frozenPenalty = state._frozenDice * 10 // 每颗冻结骰子扣10点
      atkPts = Math.max(0, atkPts - frozenPenalty)
    }

    // 灼烧伤害（上回合烈焰）
    if (state._burnDmg && state._burnDmg > 0) {
      state.hp -= state._burnDmg
      bossEffectMsg += (bossEffectMsg ? '\n' : '') + `🔥 灼烧持续：-${state._burnDmg}血`
      state._burnDmg = 0
    }

    // 暗影闪避
    if (es.shadowDodge) {
      atkPts = 0
      es.shadowDodge = false
    }

    // Player attack
    let playerAtk = atkPts + state.attack
    // 精准之眼：第1回合攻击×2
    if (state._sharpEye && state._sharpEyeTurns > 0) {
      playerAtk *= 2
      state._sharpEyeTurns--
      if (state._sharpEyeTurns <= 0) state._sharpEye = false
    }
    // 暴击
    let crit = false
    const critRate = 0.2 + (state.critBonus || 0)
    if (Math.random() < critRate) {
      playerAtk *= state.luckyClover ? 3 : 2
      crit = true
    }
    // 削骨诅咒：攻击上限+10
    // 反噬诅咒：暴击自伤25
    if (cc.includes('recoil') && crit) state.hp -= 25

    // Boss takes damage
    boss.hp -= playerAtk

    // Boss attack to player (skip if boss dead)
    let playerDef = defPts + state.dmgReduce
    let actualDmg = 0
    let shieldMsg = ''
    let thornsMsg = ''
    let poisonMsg = ''
    let bossAlive = boss.hp > 0
    if (bossAlive) {
      // 压力诅咒：减伤-3
      if (cc.includes('pressure')) playerDef -= 3
      // 削骨诅咒：防御-20
      if (cc.includes('bone')) playerDef -= 20

      // 连击：5段每段吃防御
      if (bossAtk.type === 'combo' && !bossSkip) {
        for (let i = 0; i < 5; i++) {
          actualDmg += Math.max(0, bossDmg - playerDef)
        }
      } else {
        actualDmg = Math.max(0, bossDmg - playerDef)
      }

      // 护盾
      if (actualDmg > 0 && state.shield > 0) {
        if (cc.includes('crack')) {
          actualDmg = Math.floor(actualDmg * 0.5)
          shieldMsg = `🛡️ 裂甲护盾！伤害减半（${actualDmg}）`
        } else {
          shieldMsg = `🛡️ 护盾生效！完全抵挡这次攻击`
          actualDmg = 0
        }
        state.shield--
      }

      // 吸血Boss回复
      if (bossAtk.type === 'drain' && actualDmg > 0) {
        boss.hp = Math.min(boss.maxHp, boss.hp + 20)
      }

      // 反甲（只反弹）
      if (actualDmg > 0 && state.thorns > 0) {
        boss.hp -= state.thorns
        thornsMsg = `🦔 反甲反弹${state.thorns}伤害！`
      }

      // 嗜血诅咒：每回合-2血
      if (cc.includes('bleed')) state.hp -= 2

      // 毒雾持续伤害
      if (state._poisonDmg) {
        state.hp -= state._poisonDmg
        poisonMsg = `☠️ 毒雾持续：-${state._poisonDmg}血`
      }

      // Player takes damage
      state.hp -= actualDmg
    } // end bossAlive

    // 生命汲取（优先结算，boss死了也能吸）
    let lifestealMsg = ''
    if (state.lifesteal > 0 && playerAtk > 0) {
      const heal = Math.floor(playerAtk * state.lifesteal)
      state.hp = Math.min(state.maxHp, state.hp + heal)
      lifestealMsg = `🩸 吸血回复${heal}血`
    }

    // Boss攻击特效 (only if boss alive)
    if (bossAlive && !bossSkip) {
      if (bossAtk.type === 'slash') {
        state._loseDiceNext = (state._loseDiceNext || 0) + 1
      }
      if (bossAtk.type === 'heavy') {
        boss.weakNext = true
      }
      if (bossAtk.type === 'ultimate') {
        boss.skipNext = true
      }
      if (bossAtk.type === 'poison') {
        state._poisonDmg = (state._poisonDmg || 0) + 10
      }
    }

    // Build message
    let msg = `━━ Turn ${state.bossTurn + 1} ━━\n`
    if (bossEffectMsg) msg += `${bossEffectMsg}\n`
    if (loseDiceMsg) msg += loseDiceMsg
    msg += `🎲 你骰了${diceCount}颗：[${results.join(',')}] = ${total}点\n`
    msg += `⚔️ 攻击：${atkPts}+${state.attack}${crit ? '（暴击！）' : ''} = ${playerAtk}伤害 → Boss：${boss.hp}/${boss.maxHp}\n`
    if (bossSkip) {
      msg += `${bossAtk.desc} → Boss空过！\n`
    } else if (bossAtk.type === 'combo') {
      msg += `${bossAtk.desc} 5段×${bossDmg} → 你防御${playerDef} → 实际${actualDmg}伤害\n`
    } else {
      msg += `${bossAtk.desc} ${bossDmg}伤害 → 你防御${playerDef} → 实际${actualDmg}伤害\n`
    }
    if (bossAtk.type === 'slash' && !bossSkip) msg += `⚔️ 劈砍效果：下回合骰子-1\n`
    if (bossAtk.type === 'poison' && !bossSkip) msg += `☠️ 毒雾效果：每回合-10血\n`
    if (poisonMsg) msg += `${poisonMsg}\n`
    if (bossAtk.type === 'heavy') msg += `💥 重击效果：下回合Boss伤害-20\n`
    if (thornsMsg) msg += `${thornsMsg}\n`
    if (shieldMsg) msg += `${shieldMsg}\n`
    if (lifestealMsg) msg += `${lifestealMsg}\n`
    if (state._frozenDice > 0) msg += `❄️ 冰冻效果：骰子-${state._frozenDice}颗\n`
    if (cc.includes('bleed')) msg += `🩸 嗜血诅咒：-2血\n`
    msg += `❤️ 你：${state.hp}/${state.maxHp} | Boss：${boss.hp}/${boss.maxHp}`

    state.bossTurn++

    // Boss dead?
    if (boss.hp <= 0) {
      let reward = 60000 * state.loop
      if (state.thiefGlove) reward = Math.floor(reward * 1.5)
      state.earnings += reward
      state.boss = null
      state.floor = 1
      msg += `\n\n🎉 Boss倒了！奖励 ${reward} 币\n`
      msg += `💰 本轮收益：${state.earnings} 币\n`
      msg += `🏰 已通过第${state.loop}轮\n\n`
      msg += `🏆 回复 #继续冒险（+1骰子+诅咒，下轮Boss更强）\n`
      msg += `或 #撤离（带走所有奖励）`
      state.loop++
      this._setAdv(data, uid, state)
      saveData(data)
      return e.reply(msg)
    }

    // Player dead?
    if (state.hp <= 0) {
      if (state.revives > 0) {
        state.revives--
        state.hp = Math.floor(state.maxHp * 0.5)
        msg += `\n\n✝️ 重生十字生效！复活至 ${state.hp} HP！`
        this._setAdv(data, uid, state)
        saveData(data)
        return e.reply(msg)
      }
      this._clearAdv(data, uid)
      saveData(data)
      return e.reply(msg + `\n\n💀 你倒下了…所有收益清零！\n损失：${state.earnings + ADV_FEE} 币`)
    }

    // 显示下一回合Boss攻击
    const nextTurnIdx = state.bossTurn % boss.pattern.length
    const nextAtk = boss.pattern[nextTurnIdx]
    const fog = cc.includes('fog')
    if (fog && nextTurnIdx === 2) {
      msg += `\n🔮 下回合Boss行动：❓ 迷雾遮蔽`
    } else {
      msg += `\n🔮 下回合Boss行动：${nextAtk.desc}（${nextAtk.dmg}伤害）`
    }
    // 显示下回合Boss专属效果预告
    const nextEffect = boss.effect?.id
    if (nextEffect === 'rage') msg += `\n🔥 暴怒将继续叠加`
    if (nextEffect === 'shadow' && (es.shadowTurn + 1) % 3 === 0) msg += `\n🌑 下回合暗影潜行将触发！`
    if (nextEffect === 'freeze' && (es.freezeTurn + 1) % 2 === 0) msg += `\n❄️ 下回合冰冻将触发！`
    if (nextEffect === 'thunder') msg += `\n⚡ 雷霆：30%概率雷击`
    msg += `\n🎲 骰子：${state.dice}颗`



    msg += `\n\n输入 #攻X防Y 或 全攻/全防`
    this._setAdv(data, uid, state)
    saveData(data)
    return e.reply(msg)
  }

  async advContinueLoop (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.boss) return e.reply('⚠️ 当前不能继续冒险！')

    // 给诅咒
    const available = this._getAvailableCurses(state.loop)
    const curse = available[randInt(0, available.length - 1)]
    state.curses = state.curses || []
    state.curses.push(curse.id)

    // +10骰子
    state.dice += 1

    // 吞噬诅咒：随机失去1件道具
    if (state.curses.includes('devour')) {
      const stats = ['attack', 'dmgReduce', 'thorns']
      const stat = stats[randInt(0, stats.length - 1)]
      state[stat] = Math.max(0, (state[stat] || 0) - 2)
    }

    // 应用诅咒效果
    applyCurses(state)

    state.floor = 1
    state._eventChoices = null
    state.boughtItems = []
    state.shopBought = 0
    state.funBought = 0
    this._setAdv(data, uid, state)
    saveData(data)

    let msg = `⚔️ 继续冒险！进入第${state.loop}轮\n\n`
    msg += `🎲 骰子+1颗（共${state.dice}颗）\n`
    msg += `诅咒降临：🔴 ${curse.name}（${curse.desc}）\n`
    msg += `⚠️ 下轮Boss更强！死亡归零！`
    await e.reply(msg)
    return this._showEvent(e, state)
  }

  async advEndLoop (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state || state.boss) return e.reply('⚠️ 当前不能撤离！')

    const player = getPlayer(data, uid)
    const totalEarned = state.totalEarnings + state.earnings
    player.coins += state.earnings
    state.totalEarnings = totalEarned

    // 记录最佳
    if (state.loop > (player.advBestFloor || 0)) player.advBestFloor = state.loop
    if (totalEarned > (player.advBestCoins || 0)) player.advBestCoins = totalEarned

    this._clearAdv(data, uid)
    saveData(data)

    return e.reply(
      `🏳️ 安全撤离！\n\n` +
      `💰 带走 ${state.earnings} 币\n` +
      `❤️ 剩余血量：${state.hp}/${state.maxHp}\n` +
      `🏰 通过了 ${state.loop - 1} 轮`
    )
  }

  async advRetreat (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state) return e.reply('⚠️ 你没有进行中的冒险！')

    const player = getPlayer(data, uid)
    player.coins += state.earnings
    if (state.loop > (player.advBestFloor || 0)) player.advBestFloor = state.loop
    if (state.earnings > (player.advBestCoins || 0)) player.advBestCoins = state.earnings
    const earned = state.earnings
    this._clearAdv(data, uid)
    saveData(data)

    return e.reply(
      `🏳️ 安全撤退！\n\n` +
      `💰 带走 ${earned} 币\n` +
      `❤️ 剩余血量：${state.hp}/${state.maxHp}\n` +
      `🏰 通过了 ${state.loop - 1} 轮`
    )
  }

  async advStatus (e) {
    const uid = String(e.user_id)
    const data = loadData()
    const state = this._getAdv(data, uid)
    if (!state) return e.reply('⚠️ 你没有进行中的冒险！发 #耄耋机冒险 开始')

    const cc = state.curses || []
    let msg = `🏔️ 冒险状态\n\n`
    msg += `🏰 第${state.loop}轮 / 第${state.floor}层\n`
    msg += `❤️ 血量：${state.hp}/${state.maxHp}\n`
    msg += `⚔️ 攻击：+${state.attack} | 🎲 骰子：${state.dice}颗`
    if (state.diceBonus) msg += `（+${state.diceBonus}点）`
    msg += `\n`
    if (state.shield) msg += `🛡️ 护盾：${state.shield}个\n`
    if (state.dmgReduce) msg += `🛡️ 减伤：${state.dmgReduce}\n`
    if (state.thorns) msg += `🦔 反甲：${state.thorns}\n`
    if (state.lifesteal) msg += `🩸 吸血：${Math.floor(state.lifesteal * 100)}%\n`
    if (state.critBonus) msg += `💥 暴击率：${Math.floor((0.2 + state.critBonus) * 100)}%`
    if (state.luckyClover) msg += `（×3伤害）`
    msg += `\n`
    if (state.revives) msg += `✝️ 重生十字：${state.revives}个\n`
    if (state.maodieEye) msg += `👁️ 耄耋之眼（看到全部出招） | ⚠️ Boss攻击+5\n`
    if (state.gamblerHeart) msg += `🎲 赌徒之心（骰子1-30） | ⚠️ 骰子下限-5\n`
    if (state.maodieBless) msg += `✨ 耄耋祝福（骰子+5） | ⚠️ 最大血量-20\n`
    if (state.thiefGlove) msg += `🧤 偷窃手套（奖励+50%） | ⚠️ Boss血量+30%\n`
    msg += `💰 收益：${state.earnings} 币\n`
    if (cc.length) msg += `诅咒：${cc.map(id => ADV_CURSES.find(c => c.id === id)?.name || id).join('、')}\n`
    msg += `\n发 #冒险继续 或 #冒险撤退`
    return e.reply(msg.trim())
  }



  async advRank (e) {
    const data = loadData()
    const entries = Object.entries(data).filter(([k, p]) => !k.startsWith('_') && p.advBestFloor)
    if (!entries.length) return e.reply('🏔️ 还没人冒险过！发 #耄耋机冒险 开始')

    entries.sort((a, b) => (b[1].advBestCoins || 0) - (a[1].advBestCoins || 0))
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
    let msg = '🏔️ 冒险排行榜\n━━━━━━━━━━━━━━━\n'
    entries.slice(0, 10).forEach(([uid, p], i) => {
      msg += `${medals[i]} ${uid} — 最高${p.advBestFloor}轮 | 最多${p.advBestCoins || 0}币\n`
    })
    return e.reply(msg.trim())
  }
}
