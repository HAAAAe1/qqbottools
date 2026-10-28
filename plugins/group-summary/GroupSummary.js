// 群聊总结 —— #总结 [条数]
// 总结群聊最近 N 条消息（默认 100 条，上限 200）
// 涉及封号等敏感内容的消息会整条打码为 **，不进入 AI、不出现于总结中
import fetch from "node-fetch";
import { writeFileSync, appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __DIR = dirname(fileURLToPath(import.meta.url))

/**
 * DeepSeek API key（#总结 用）
 * 优先级：环境变量 DEEPSEEK_API_KEY → 同目录 data/deepseek.json 的 apiKey 字段
 * 2026-10-28 从硬编码改成外部读取，避免明文 key 进入公开仓库
 */
const DEEPSEEK_API_KEY = (() => {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim()
  try {
    return String(JSON.parse(readFileSync(join(__DIR, 'data', 'deepseek.json'), 'utf8')).apiKey || '').trim()
  } catch { return '' }
})()

// 敏感关键词：命中则整条消息打码为 **（可按需增删）
const SENSITIVE_RE = /封号|被封|封禁|冻结|风控|限制登录/;

const DEFAULT_COUNT = 100
const MAX_COUNT = 200
// 有效消息少于该条数时直接提示，不调用 AI（避免 AI 对着空内容胡编）
const MIN_REAL_LINES = 3

// 调试日志：记录发给 AI 的内容和 AI 的回复，排查问题用
const DEBUG_LOG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "logs", "groupsummary-debug.log")

function debugLog(...args) {
  try {
    const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ` + args.join(' ') + '\n'
    appendFileSync(DEBUG_LOG, line, 'utf8')
  } catch { /* 日志失败不影响主流程 */ }
}

export class GroupSummary extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '[土块插件]群聊总结',
      /** 功能描述 */
      dsc: '总结群聊最近消息（#总结 [条数]）',
      event: 'message',
      /** 优先级，数字越小等级越高 */
      priority: 1143,
      rule: [{
        reg: "^#(群聊)?总结(\\d*)$",
        fnc: 'summary'
      }]
    })
  }

  async summary(e) {
    if (!e.isGroup) {
      e.reply('只能在群里使用哦')
      return
    }
    const m = e.msg.match(/^#(?:群聊)?总结(\d*)$/)
    let count = DEFAULT_COUNT
    if (m && m[1]) {
      count = parseInt(m[1]) || DEFAULT_COUNT
      if (count > MAX_COUNT) count = MAX_COUNT
    }

    e.reply(`📝 正在总结最近 ${count} 条消息，请稍等…`)

    const chats = await this.getHistory(e, count)
    if (!chats.length) {
      e.reply('获取消息记录失败了，稍后再试')
      return
    }

    const transcript = this.buildTranscript(chats, e)
    const realLines = transcript.split('\n').filter(l => l.trim() && !l.includes(': **')).length
    debugLog(`群=${e.group_id} 拉取=${chats.length}条 有效行=${realLines}`)
    if (!transcript) {
      e.reply('没有可总结的消息内容')
      return
    }
    // 有效内容太少：直接提示，不浪费一次 AI 调用（AI 对着空内容会胡编）
    if (realLines < MIN_REAL_LINES) {
      e.reply(`最近 ${chats.length} 条消息里大多是机器人回复或指令，没有足够内容可以总结。等群里聊起来再试 #总结 吧～`)
      return
    }

    debugLog(`--- transcript (${transcript.length}字) 前1500字 ---\n` + transcript.slice(0, 1500))

    const summary = await this.askAI(transcript)
    if (!summary) {
      e.reply('AI 总结失败了，稍后再试')
      return
    }
    // 输出前再打码一遍，防止 AI 提及敏感内容
    const safe = summary.replace(SENSITIVE_RE, '**')
    debugLog(`--- AI 回复 ---\n` + safe)
    // 转发聊天记录形式：标题一条 + 总结正文按段落拆成多条
    const nickname = e.bot?.nickname || '机器人'
    const user_id = e.bot?.uin || e.self_id
    const msgList = [
      { message: `📊 群聊总结（最近 ${chats.length} 条消息）：`, nickname, user_id },
      ...safe.split(/\n{2,}/).filter(p => p.trim()).map(p => ({
        message: p.trim(),
        nickname,
        user_id
      }))
    ]
    const sendForward = e.group?.sendForwardMsg || e.friend?.sendForwardMsg
    if (sendForward) {
      await sendForward(msgList)
    } else {
      e.reply(`📊 群聊总结（最近 ${chats.length} 条消息）：\n\n${safe}`)
    }
  }

  /**
   * 获取群聊消息历史
   * 策略：先单次请求（message_seq=0 时 NapCat 走 getAioFirstViewLatestMsgs，可一次取多条），
   *       不足再翻页兜底
   */
  async getHistory(e, count) {
    try {
      const collected = []

      // 1) 单次大数量请求
      try {
        const res = await e.bot.sendApi("get_group_msg_history", {
          group_id: e.group_id,
          message_seq: 0,
          count,
          reverseOrder: true
        })
        const batch = res?.messages
        if (batch?.length) {
          collected.push(...batch)
          debugLog(`  单次请求 count=${count} 返回 ${batch.length} 条`)
        }
      } catch (ex) {
        debugLog(`  单次请求失败: ${ex?.message || ex}`)
      }

      // 2) 不足则翻页（reverseOrder=false，测试是否能拿到更早的消息）
      if (collected.length < count) {
        let seq = collected.length ? (collected[collected.length - 1]?.message_seq ?? 0) : 0
        let guard = 0
        while (collected.length < count && guard < 10) {
          guard++
          let page
          try {
            const res = await e.bot.sendApi("get_group_msg_history", {
              group_id: e.group_id,
              message_seq: seq,
              count: 20,
              reverseOrder: false
            })
            page = res?.messages
          } catch (ex) {
            debugLog(`  翻页#${guard} seq=${seq} 失败: ${ex?.message || ex}`)
            break
          }
          if (!page || page.length === 0) {
            debugLog(`  翻页#${guard} seq=${seq} 空批次`)
            break
          }
          collected.push(...page)
          const last = page[page.length - 1]
          const lastSeq = last?.message_seq ?? last?.message_id
          debugLog(`  翻页#${guard} seq=${seq} 返回${page.length}条; 末条=${lastSeq} real_seq=${last?.real_seq}`)
          if (!lastSeq || lastSeq === seq) break
          seq = lastSeq
        }
      }

      // 去重（防止翻页边界重复），再截取所需条数
      const seen = new Set()
      const chats = []
      for (const c of collected) {
        const id = c?.message_id ?? c?.message_seq ?? c?.seq
        if (!id || seen.has(id)) continue
        seen.add(id)
        chats.push(c)
        if (chats.length >= count) break
      }
      debugLog(`  去重后 ${chats.length} 条`)
      // 反转为从旧到新（时间正序）
      return chats.reverse()
    } catch (err) {
      console.log('[群聊总结]获取消息历史失败', err)
      return []
    }
  }

  /**
   * 把消息历史转成「昵称: 内容」文本，敏感内容整条打码为 **
   */
  buildTranscript(chats, e) {
    const botId = String(e.bot?.uin || '')
    const lines = []
    for (const chat of chats) {
      if (!chat) continue
      const sender = chat.sender || {}
      // 跳过机器人自己的消息
      if (botId && String(sender.user_id || '') === botId) continue
      const name = sender.card || sender.nickname || sender.user_id || '未知'
      let text = this.chatToText(chat)
      if (!text) continue
      // 去掉开头的 @提及 再判断是否是触发命令本身
      const stripped = text.replace(/^(@\S+\s*)+/, '')
      if (/^#(群聊)?总结/.test(stripped)) continue
      // 涉及封号等敏感内容 → 整条打码
      if (SENSITIVE_RE.test(text)) {
        text = '**'
      } else if (text.length > 100) {
        text = text.slice(0, 100) + '…'
      }
      lines.push(text)
    }
    let transcript = lines.join('\n')
    // 超长截断（保留最新部分）
    if (transcript.length > 8000) {
      transcript = transcript.slice(-8000)
    }
    return transcript
  }

  /**
   * 消息段转纯文本（OneBot raw_message 里的 CQ 码转成可读文本）
   */
  chatToText(chat) {
    if (chat.raw_message) return this.cqToText(chat.raw_message)
    if (Array.isArray(chat.message)) {
      return chat.message.map(seg => {
        if (!seg) return ''
        if (seg.type === 'text') return seg.text || ''
        if (seg.type === 'image') return '[图片]'
        if (seg.type === 'face') return '[表情]'
        if (seg.type === 'at') return seg.text || '@' + (seg.qq || '')
        if (seg.type === 'record') return '[语音]'
        if (seg.type === 'video') return '[视频]'
        if (seg.type === 'reply') return '[回复]'
        if (seg.type === 'forward') return '[转发消息]'
        return `[${seg.type}]`
      }).join('').trim()
    }
    return ''
  }

  /**
   * CQ 码 → 可读文本
   */
  cqToText(raw) {
    // HTML 实体还原
    let s = String(raw)
      .replace(/&#91;/g, '[').replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',').replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    // 逐个替换 CQ 码
    return s.replace(/\[CQ:([a-z]+)((?:,[^\[\]]*)*)\]/g, (m, type, params) => {
      const p = {}
      for (const kv of params.split(',').filter(Boolean)) {
        const i = kv.indexOf('=')
        if (i > 0) p[kv.slice(0, i)] = kv.slice(i + 1)
      }
      switch (type) {
        case 'at': return p.qq === 'all' ? '@全体成员' : `@${p.qq}`
        case 'image': return '[图片]'
        case 'face': return '[表情]'
        case 'record': return '[语音]'
        case 'video': return '[视频]'
        case 'reply': return '[回复]'
        case 'forward': return '[转发消息]'
        case 'node': return '[合并转发]'
        case 'markdown': return this.markdownToText(p.content)
        case 'json': {
          try {
            const d = JSON.parse(p.data || '{}')
            const text = d.prompt || d.meta?.detail_1?.desc || d.desc || d.text || ''
            return text ? `[小程序]${text}` : '[小程序]'
          } catch { return '[小程序]' }
        }
        case 'rich': return '[富文本]'
        case 'xml': return '[链接卡片]'
        default: return `[${type}]`
      }
    }).trim()
  }

  /**
   * markdown 卡片：尝试从 URL 编码的 JSON 里抠出可读文本
   */
  markdownToText(content) {
    try {
      if (!content) return '[卡片]'
      let c = content
      if (c.includes('%')) {
        try { c = decodeURIComponent(c) } catch { /* 保留原样 */ }
      }
      c = c.replace(/<[^>]+>/g, ' ') // 去 HTML 标签
      const m = c.match(/"(?:text|content|prompt)":"((?:[^"\\]|\\.)*)"/)
      const t = m ? m[1] : c
      const clean = t.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\s+/g, ' ').trim()
      return clean ? `[卡片]${clean.slice(0, 60)}` : '[卡片]'
    } catch { return '[卡片]' }
  }

  /**
   * 调用 AI 总结（DeepSeek 官方 API，与 chatgpt-plugin initDB.js 同 key）
   * 带一次重试：首次输出太短/答非所问时，用更严格的提示再试一次
   */
  async askAI(transcript) {
    if (!DEEPSEEK_API_KEY) {
      debugLog('未配置 DeepSeek key，跳过 AI 总结')
      return undefined
    }
    const buildPrompt = (transcript, strict = false) => {
      const strictNote = strict
        ? '注意：如果上面这段群聊记录内容太少或只有指令，请直接回复「内容太少，无法总结」，不要展开、不要编造、不要给建议。'
        : ''
      return [
        '你是一个QQ群聊总结助手。请用简洁的中文总结下面这段群聊记录，分点输出：',
        '1. 主要话题',
        '2. 重要信息或结论',
        '3. 值得注意的事件',
        '要求：简明扼要，不要编造。记录中被标记为 ** 的消息是敏感内容，直接忽略，不要提及、不要猜测。',
        strictNote,
        '',
        '群聊记录：',
        transcript
      ].join('\n')
    }

    const call = async (prompt) => {
      try {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024
          })
        });
        if (!response.ok) {
          console.log('[群聊总结]DeepSeek 请求失败', response.status)
          return undefined
        }
        const j = await response.json();
        return j?.choices?.[0]?.message?.content?.trim() || undefined;
      } catch (err) {
        console.log('[群聊总结]DeepSeek 请求异常', err)
        return undefined
      }
    }

    // 答非所问特征：太短，或 AI 在吐槽内容本身而不是总结
    const isGarbage = (text) => {
      if (!text) return true
      if (text.length < 15) return true
      return /(只能总结|内容太少|无法总结|没有足够|乱码|编码问题|你应该是想|你是不是想问|看起来你的消息)/.test(text)
    }

    let summary = await call(buildPrompt(transcript, false))
    if (isGarbage(summary)) {
      debugLog('--- 首次输出异常，重试 ---\n' + (summary || '(空)'))
      summary = await call(buildPrompt(transcript, true))
    }
    if (isGarbage(summary)) {
      debugLog('--- 重试仍异常 ---\n' + (summary || '(空)'))
      return undefined
    }
    return summary
  }
}
