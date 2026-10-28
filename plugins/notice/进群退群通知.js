/**
 * 入群欢迎 / 退群通知
 * 2026-10-26：改为「按群开关、默认关闭」，由群主 / 群管理员控制
 *   群管理：#欢迎新人 开启/关闭   #退群通知 开启/关闭   #通知设置（查看本群状态）
 *   状态存 plugins/example/data/notice-switch.json，结构 { "<群号>": { welcome, quit } }
 *   Bot 主人不受群限制（loader 的 admin 权限对 isMaster 直接放行）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(__dirname, 'data', 'notice-switch.json')

/** 默认全关 */
const DEFAULTS = { welcome: false, quit: false }

/** 进程内缓存；文件热重载时模块重新加载，缓存随之重建 */
let stateCache = null

function loadState () {
  if (stateCache) return stateCache
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    stateCache = raw && typeof raw === 'object' ? raw : {}
  } catch {
    stateCache = {}
  }
  return stateCache
}

function saveState () {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(loadState(), null, 2))
}

/** 取某群配置（缺省 = 全关） */
function groupState (gid) {
  const all = loadState()
  return { ...DEFAULTS, ...(all[String(gid)] || {}) }
}

function setGroupState (gid, next) {
  const all = loadState()
  all[String(gid)] = { ...DEFAULTS, ...next }
  saveState()
}

export class newcomer extends plugin {
  constructor() {
    super({
      name: "欢迎新人",
      dsc: "新人入群欢迎（群管理可开关，默认关闭）",
      event: "notice.group.increase",
    })
  }

  async accept() {
    if (!groupState(this.e.group_id).welcome) return
    if (this.e.user_id == this.e.self_id) return

    /** 定义入群欢迎内容 */
    let msg = "欢迎新人！"
    /** 冷却cd 30s */
    let cd = 30

    /** cd */
    let key = `Yz:newcomers:${this.e.group_id}`
    if (await redis.get(key)) return
    redis.set(key, "1", { EX: cd })

    /** 回复 */
    await this.reply([
      segment.at(this.e.user_id),
      // segment.image(),
      msg,
    ])
  }
}

export class outNotice extends plugin {
  constructor() {
    super({
      name: "退群通知",
      dsc: "xx退群了（群管理可开关，默认关闭）",
      event: "notice.group.decrease",
    })

    /** 退群提示词 */
    this.tips = "退群了"
  }

  async accept() {
    if (!groupState(this.e.group_id).quit) return
    if (this.e.user_id == this.e.self_id) return

    let name, msg
    if (this.e.member) {
      name = this.e.member.card || this.e.member.nickname
    }

    if (name) {
      msg = `${name}(${this.e.user_id}) ${this.tips}`
    } else {
      msg = `${this.e.user_id} ${this.tips}`
    }
    logger.mark(`[退出通知]${this.e.logText} ${msg}`)
    await this.reply(msg)
  }
}

/** 开关命令：群主 / 群管理员可用，按群生效 */
export class noticeSwitch extends plugin {
  constructor() {
    super({
      name: "入群退群通知开关",
      dsc: "群管理开关欢迎新人 / 退群通知（默认关闭）",
      event: "message",
      priority: 300,
      rule: [
        { reg: "^#欢迎新人\\s*(开启|开|关闭|关)?$", fnc: "toggleWelcome", permission: "admin" },
        { reg: "^#退群通知\\s*(开启|开|关闭|关)?$", fnc: "toggleQuit", permission: "admin" },
        { reg: "^#通知设置$", fnc: "status", permission: "admin" }
      ]
    })
  }

  async toggleWelcome() {
    return this.toggle("welcome")
  }

  async toggleQuit() {
    return this.toggle("quit")
  }

  async status() {
    if (!this.e.isGroup) {
      await this.e.reply("这个设置按群生效，请在群里发送")
      return true
    }
    await this.e.reply(this.statusText(groupState(this.e.group_id)))
    return true
  }

  async toggle(key) {
    if (!this.e.isGroup) {
      await this.e.reply("这个开关按群生效，请在群里发送")
      return true
    }

    const arg = (String(this.e.msg || "").match(/(开启|开|关闭|关)\s*$/) || [])[1]
    const cur = groupState(this.e.group_id)
    const label = key === "welcome" ? "欢迎新人" : "退群通知"

    // 不带参数 = 看状态
    if (!arg) {
      await this.e.reply(this.statusText(cur))
      return true
    }

    const on = arg === "开启" || arg === "开"
    cur[key] = on
    setGroupState(this.e.group_id, cur)
    await this.e.reply(`${on ? "✅ 本群「" + label + "」已开启" : "⭕ 本群「" + label + "」已关闭"}`)
    return true
  }

  statusText(cur) {
    return [
      "🔔 本群通知设置",
      `· 欢迎新人：${cur.welcome ? "已开启" : "已关闭"}`,
      `· 退群通知：${cur.quit ? "已开启" : "已关闭"}`,
      "",
      "切换：#欢迎新人 开启/关闭 · #退群通知 开启/关闭",
      "仅群主 / 管理员可修改，默认关闭"
    ].join("\n")
  }
}
