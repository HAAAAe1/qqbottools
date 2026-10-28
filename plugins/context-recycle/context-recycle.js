import plugin from '../../lib/plugins/plugin.js'
import sqlite3 from 'sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * AI 会话闲置自动轮换（上下文回收）
 *
 * 背景：chaite 会话不自动轮换，上下文无限增长（token 越烧越多、
 *   人设被历史带脏），只能手动发 #结束对话 才清。
 *
 * 原理：定时扫描所有用户，对「当前会话最后一条消息距今超过阈值」的，
 *   双换 current.conversationId + current.messageId，
 *   效果等同于手动 #结束对话（management.js destroyConversation 同款做法）。
 *   静默执行，只写日志，不打扰用户。
 *
 * 判活依据说明：user_states.updatedAt 每条 AI 消息都会自动刷新，是最精确的
 *   「最后交互时间」，但 storage 的读接口（listItems 等）都不返回它；
 *   history 的消息对象也不带 createdAt（它在表列，不在 messageData 里）。
 *   所以改查 history 表当前会话的 MAX(createdAt)。
 *
 * 为什么不 import chaite：chaite 只装在 plugins/chatgpt-plugin/node_modules 下，
 *   按模块位置解析不到；直接 SQL 操作自包含可审计。写回用乐观锁
 *   （WHERE current = 读到的原值），防止并发覆盖用户刚落的新消息。
 *
 * 2026-10-19 按用户要求上线（方案 A，阈值 3 小时）。
 * 2026-10-20 按用户要求阈值改为 2 小时。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 闲置阈值：2 小时 */
const IDLE_MS = 2 * 60 * 60 * 1000

/** chaite 的 SQLite 库 */
const DB_PATH = path.join(__dirname, '../chatgpt-plugin/data/data.db')

export default class ContextRecycle extends plugin {
  constructor () {
    super({
      name: 'AI会话闲置轮换',
      dsc: 'AI会话闲置超时自动轮换上下文',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#清理闲置会话$', fnc: 'manualSweep', permission: 'master' }
      ]
    })
    this.task = [{
      name: 'AI会话闲置轮换',
      cron: '*/30 * * * *',
      fnc: () => this.sweep()
    }]
  }

  /** 查某个会话最后一条消息的时间（ISO 字符串）；无消息返回 null */
  lastActivity (db, conversationId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT MAX(createdAt) AS last FROM history WHERE conversationId = ?',
        [conversationId],
        (err, row) => {
          if (err) return reject(err)
          resolve(row?.last || null)
        }
      )
    })
  }

  /**
   * 乐观锁写回：current 必须还是我们读到的原样才更新，
   * 防止轮换覆盖用户刚落的新消息（被改过就跳过，下轮再来）
   * @returns {Promise<number>} 受影响行数
   */
  rotate (db, userId, oldCurrent, newCurrent) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE user_states SET current = ?, updatedAt = ? WHERE userId = ? AND current = ?',
        [JSON.stringify(newCurrent), Date.now(), userId, oldCurrent],
        function (err) {
          if (err) return reject(err)
          resolve(this.changes)
        }
      )
    })
  }

  /** 扫描全部用户；单个用户失败不影响其他用户 */
  async sweep () {
    if (!fs.existsSync(DB_PATH)) {
      logger.error(`[context-recycle] chaite 数据库不存在: ${DB_PATH}`)
      return
    }
    const db = await new Promise((resolve, reject) => {
      const d = new sqlite3.Database(DB_PATH, err => (err ? reject(err) : resolve(d)))
    })
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all('SELECT userId, current FROM user_states', (err, rows) => (err ? reject(err) : resolve(rows)))
      })
      let rotated = 0
      for (const row of rows) {
        try {
          let current
          try {
            current = JSON.parse(row.current)
          } catch {
            continue
          }
          if (!current?.conversationId || !current?.messageId) continue

          const last = await this.lastActivity(db, current.conversationId)
          if (!last) continue // 刚开的新会话还没聊过，无从判断

          const idleMs = Date.now() - new Date(last).getTime()
          if (!(idleMs >= IDLE_MS)) continue

          const next = {
            ...current,
            conversationId: crypto.randomUUID(),
            messageId: crypto.randomUUID()
          }
          const changes = await this.rotate(db, row.userId, row.current, next)
          if (changes > 0) {
            rotated++
            logger.mark(`[context-recycle] 用户 ${row.userId} 会话闲置 ${(idleMs / 3600000).toFixed(1)} 小时，已静默轮换`)
          } else {
            logger.debug(`[context-recycle] 用户 ${row.userId} 期间有新消息，跳过本轮`)
          }
        } catch (err) {
          logger.error(`[context-recycle] 用户 ${row.userId} 处理失败: ${err.message}`)
        }
      }
      if (rotated > 0) logger.mark(`[context-recycle] 本轮共轮换 ${rotated} 个闲置会话`)
    } finally {
      db.close()
    }
  }

  /** 主人手动触发一次（调试/立即生效用，不用等 cron） */
  async manualSweep (e) {
    await this.sweep()
    this.reply('已扫描一轮闲置会话（阈值 2 小时，轮换详情见日志）')
  }
}
