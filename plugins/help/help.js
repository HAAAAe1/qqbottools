/**
 * 帮助插件：发送 #help
 * 2026-10-26 v4：主菜单拆成两张图 —— 第一张「基础功能」、第二张「FF14 相关」
 * 转发顺序：基础功能图 → FF14 图 → 土块帮助图 → 网站/积分文案 → 积分海报
 * 渲染用 data.path 直接落盘；转发失败重试一次，仍失败回退文本
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class help extends plugin {
  constructor () {
    super({
      name: '帮助',
      dsc: '查看机器人功能（#帮助 / #help / #菜单）',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#help$',
          fnc: 'help',
          permission: 'all'
        }
      ]
    })
  }

  async help () {
    const baseBlocks = this.getBaseBlocks()
    const ff14Blocks = this.getFf14Blocks()
    const tukuai = path.join(__dirname, 'resources', 'help', 'guoba-help.jpg')
    const poster = path.join(__dirname, 'resources', 'workbuddy-invite-poster.png')

    /** 2026-10-26 按用户要求：菜单拆两张图 —— 第一张基础功能，第二张 FF14 */
    const [baseImg, ff14Img] = await Promise.all([
      this.renderHelpImage('base', {
        blocks: baseBlocks,
        title: '🤖 414bot 功能菜单',
        subtitle: '基础功能 · 发送对应指令即可使用 · #help 可随时重新查看'
      }),
      this.renderHelpImage('ff14', {
        blocks: ff14Blocks,
        title: '🐤 FF14 相关功能',
        subtitle: 'FF14 专用指令 · #help 可随时重新查看'
      })
    ])

    const messages = [
      baseImg ? segment.image(baseImg) : this.blocksToText(baseBlocks),
      ff14Img ? segment.image(ff14Img) : this.blocksToText(ff14Blocks),
      ...(fs.existsSync(tukuai) ? [segment.image(tukuai)] : []),
      '欢迎访问我闲的没事干用ai做的个人网站 https://haaaae1.github.io/#',
      '🧧 顺便混点积分：扫码注册 WorkBuddy 领 2000 积分 —— 找个 AI 搭子帮你干活，还能一起薅（下图扫码）',
      ...(fs.existsSync(poster) ? [segment.image(poster)] : [])
    ]

    /** 转发失败重试一次，仍失败 → 回退文本 */
    let ok = await this.sendForward(messages)
    if (!ok) {
      await new Promise(r => setTimeout(r, 1500))
      ok = await this.sendForward(messages)
    }
    if (!ok) await this.reply(this.blocksToText([...baseBlocks, ...ff14Blocks]))
    return true
  }

  /** 渲染帮助图：截图后端直接落盘，返回文件路径；失败返回 null */
  async renderHelpImage (name, data) {
    try {
      if (!this.e.runtime?.render) return null
      const file = path.join(process.cwd(), 'temp', 'help', `${name}.jpg`)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.rmSync(file, { force: true })
      // retType base64：仅跳过 runtime 的自动回复，返回值不可靠，实际取 data.path 落盘文件
      await this.e.runtime.render('example', 'help/index', {
        ...data,
        imgType: 'jpeg',
        quality: 85,
        path: file
      }, {
        e: this.e,
        retType: 'base64'
      })
      // 校验确实是完整 JPEG（FF D8 FF）而非空/垃圾文件
      if (!fs.existsSync(file)) return null
      const head = fs.readFileSync(file).subarray(0, 3)
      if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return null
      return file
    } catch (err) {
      logger.error(`[help] 帮助图渲染失败 ${name}`, err)
      return null
    }
  }

  blocksToText (blocks) {
    // 分组标记（§ 开头）在文本里还原成一行分隔标题，别把 § 直接发出去
    return blocks.map(b => b[0][0] === '§' ? `【${b[0].slice(1).trim()}】` : b.join('\n')).join('\n\n')
  }

  /** 合并转发聊天记录；成功 true，失败 false（调用方回退文本） */
  async sendForward (messages) {
    const msgList = messages.map(message => ({
      message,
      nickname: this.e.bot?.nickname || '机器人',
      user_id: this.e.bot?.uin || this.e.self_id
    }))
    const sendForward = this.e.group?.sendForwardMsg || this.e.friend?.sendForwardMsg
    if (!sendForward) return false
    try {
      await sendForward(msgList)
      return true
    } catch (err) {
      logger.error('[help] 转发发送失败，回退为文本', err)
      return false
    }
  }

  /**
   * 第一张图：基础功能（原「其他功能」，2026-10-26 改名并提到第一张）
   * 入群欢迎 / 退群通知已停用，原「✨ 自动功能」卡片同步删除
   */
  getBaseBlocks () {
    return [
      [
        '📌 说明',
        '本图是基础功能，FF14 相关指令见第二张图',
        '土块插件指令见转发里的土块帮助图'
      ],
      [
        '💬 智能对话',
        '· 直接 @机器人 提问，会自动查资料回答',
        '· #结束对话 —— 清空当前会话'
      ],
      [
        '🔁 娱乐',
        '· #复读 —— 复读你发送的内容',
        '· #战场 —— FF14纷争前线模拟战小游戏',
        '· #耄耋机功能 —— 查看老虎机全部命令和说明',
        '· #合成 😂 😭 —— 两个 emoji 合成表情图',
        '· #今日小猪 —— 抽取今天属于你的专属小猪 🐷',
        '· #随机小猪 —— 随机抽取一只小猪（每天可多次）',
        '· #查找小猪 名字 —— 搜索小猪（如 #查找小猪 野猪）',
        '· #猪猪图鉴 —— 查看你收集过的所有小猪',
        '· #今日耄耋 —— 抽取今天属于你的耄耋表情 🐱',
        '· #随机耄耋 —— 随机抽取一只耄耋（每天可多次）',
        '· #查找耄耋 名字 —— 搜索耄耋（如 #查找耄耋 无奈）',
        '· #耄耋图鉴 —— 查看你收集过的所有耄耋'
      ],
      [
        '🎵 音乐放歌',
        '· #放首歌 —— 随机放一首，自动截高潮 60 秒（一轮内不重复）',
        '· #听首歌 / #放音乐 —— 同上，同义触发词',
        '· #放整首 / #放整首 晴天 —— 完整播放，按 60 秒拆成几条语音依次发（最长 12 段）',
        '· #音乐 晴天 —— 指定歌曲，自动截高潮 60 秒',
        '· #音乐 晴天 45 —— 从高潮起点截 45 秒（上限 60 秒）',
        '· #音乐 晴天 62-95 —— 手动指定起止秒数',
        '· #音乐列表 —— 看整个曲库，转发形式发（一条消息列全，不分页）',
        '· #音乐信息 晴天 —— 看时长和高潮段是怎么判的',
        '· #放首哈基米歌 —— 从哈基米曲库随机放一首（独立曲库，洗牌不重复）',
        '· #放首哈基米歌 45 —— 同上，截 45 秒',
        '· #放首完整哈基米歌 —— 哈基米曲库随机抽一首完整放，按 60 秒拆段',
        '· #放首完整哈基米歌 歌名 —— 指定哈基米曲库里的某一首，完整放',
        '· #哈基米列表 —— 看哈基米曲库',
        '· 仅bot管理员：#音乐扫描 / #音乐标注 歌名 62-95 / #音乐清除标注 歌名 / #哈基米扫描',
        '· 曲库是本地音频文件，QQ 语音固定 8kHz，音质约等于打电话'
      ],
      [
        '🧱 土块插件',
        '· #土块帮助 —— 插件说明：记忆力小游戏、图片可视化点歌、原史等功能',
        '· #总结 [条数] —— 总结群聊最近消息（默认100条，敏感内容自动打码）'
      ],
      [
        '🧠 记忆',
        '· #记忆 / #我的记忆 —— 查看私人记忆',
        '· #群记忆 —— 查看群记忆',
        '· #删除记忆 1 / #删除群记忆 1 —— 删除指定记忆'
      ],
      [
        '🪪 群名片',
        '· #设置名片 名字 —— 设置机器人的群名片'
      ],
      [
        '⚙️ 管理（仅bot管理员）',
        '· #chatgpt管理面板 —— 打开 Web 管理面板',
        '· #chatgpt渠道列表 / #预设列表 / #工具列表',
        '· #状态 / #日志 / #重启 / #更新',
        '· #结束全部对话 —— 清空所有人的对话上下文（仅bot管理员，不可恢复）'
      ],
      [
        '🔔 入群 / 退群通知（默认关闭）',
        '· #欢迎新人 开启 / 关闭 —— 新人入群时 @ 并欢迎（群主 / 管理员）',
        '· #退群通知 开启 / 关闭 —— 成员退群时在群里播报（群主 / 管理员）',
        '· #通知设置 —— 查看本群两个开关的当前状态',
        '· 开关按群生效，只影响发命令的那个群'
      ]
    ]
  }

  /** 第二张图：FF14 相关 */
  getFf14Blocks () {
    return [
      [
        '🔍 FF14 查询（灰机wiki）',
        '· #f 关键词 —— 查副本、物品、任务、NPC 攻略',
        '· 等同：#查询 / #ff14 / #wiki'
      ],
      [
        '📊 FFLogs 战绩',
        '· #fflogs 白银乡 Camera —— 查 7 个绝本（含旧版）+ 暗黑之云 + 当前大版本零式',
        '· #fflogs 白银乡 Camera 6 —— 末尾加版本号 2~7，只看该版本的零式 + 绝本',
        '· 3=亚历山大零式 / 4=巴哈·神兵 / 5=亚历山大 / 6=龙诗·欧米茄 / 7=光暗·妖星',
        '· 2.x 查不到：FFLogs 不收录巴哈姆特大迷宫，绝本最早从 4.x 开始',
        '· 服务器用中文名（白银乡 / 红玉海 / 旅人栈桥…）',
        '· 角色名要和 FFLogs 上完全一致（繁简、空格都算）',
        '· 每行：Best / 最高RDPS / Kills / 全明星积分与排名 / 最快击杀 / 最后通关',
        '· 没打过的副本也占一行标「未通关」，不会漏显示'
      ],
      [
        '🔗 BIS 配装',
        '· #bis 战士 —— 查询职业最新 BIS 配装链接',
        '· #bis 黑魔 7.4零式 / 伊甸 —— 加 版本/副本名 过滤',
        '· #bis 战士 绝妖 —— 俗称也能搜（绝妖=绝凯夫卡）',
        '· #bis检测 —— 查源文档有没有更新（每周自动查一次，有新版会私聊提示）',
        '· #更新bis —— 重新解析本地配装数据'
      ],
      [
        '💰 市场物价',
        '· #市场 优纯银锭 —— 查国服最便宜的五个区服：价格、在售数量、HQ 最低价',
        '· #市场 优纯银锭 hq —— 只看 HQ 价格',
        '· #市场 44148 —— 名字搜不到时（新物品）直接用物品 ID',
        '· 每行：世界名（大区） 价格 金 ×数量 在售 N  HQ xxx',
        '· 仅bot管理员：#市场更新（有新物品才下载）/ #市场更新 强制'
      ],
      [
        '🌐 网站导航',
        '· #查网站 物价 —— 按需求找站：物价 / 配装 / 攻略 / 房子 / 幻化 / 时钟…',
        '· #查网站 —— 看全部 14 个分类',
        '· #查网站 幻化相关 —— 输入分类名可直接列出该分类站点',
        '· 结果以聊天记录转发发送；数据源 gamecircum.com（177 个站点）',
        '· 仅bot管理员：#更新网站'
      ],
      [
        '🏠 FF14 房屋订阅',
        '· #房屋查询 白银乡 L —— 立刻查一次在售（S/M/L 可换，默认 L）',
        '· #房屋查询订阅 白银乡 L —— 订阅，每晚 21:00 合并推送到本群/私聊',
        '· #房屋查询退订 [服务器] —— 退掉自己的订阅（不写服务器=全退）',
        '· #房屋查询订阅列表 —— 全部订阅总览（仅bot管理员）',
        '· 管理员：#禁止订阅 [群号] / #允许订阅 [群号]（不写=本群；群管理只能改本群）',
        '· 仅bot管理员：#清除订阅群聊 <群号> / #清除订阅个人 <QQ>'
      ],
      [
        '📰 FF14 国服公告推送',
        '· #查看ff14最近新闻 —— 立刻看最近 5 条官方公告（不订阅也能用）',
        '· #开启ff14新闻推送 —— 有新公告自动推送到本群 / 私聊（每两小时查一次）',
        '· #关闭ff14新闻推送 —— 关掉本群 / 私聊的推送',
        '· 推官方「最新情报」：维护公告、版本更新笔记、季节活动、联动、商城周边'
      ],
      [
        '⚔️ PVP 轮换',
        '· #pvp —— 查看今日及本周 PVP 轮换（自动按日期更新）'
      ],
      [
        '📅 石之家签到（仅bot管理员私聊）',
        '· #石之家 —— 打开石之家浏览器（登录用的那个，自己操作）',
        '· #石之家绑定 <cURL> —— 绑定石之家账号（首次，浏览器复制请求）',
        '· #石之家签到 —— 手动签到一次',
        '· #石之家自动签到 开启 —— 每天 09:00 自动签到',
        '· #石之家状态 / #石之家解绑 —— 查看状态或解绑'
      ],
      [
        '👗 随机幻化',
        '· #随机幻化 —— 随机来一套，出图 + 全套装备与染色',
        '· #随机幻化 拉拉肥 —— 指定种族：猫娘 / 兔娘 / 龙娘 / 大猫 / 精灵 / 鲁加 / 人（也可发 1~8）',
        '· 带种族的要多刷几次（约 3~6 秒）；冷却 10 秒 / 带种族 30 秒'
      ],
      [
        '💡 提示：查 FF14 攻略最快的方式就是发 #f 关键词'
      ]
    ]
  }
}
