// emojimix.js - emoji 合成插件（Google Emoji Kitchen）
// 用法：#合成 😂 😭   /   #emojimix 😀 😀
// 代理配置：环境变量 HTTPS_PROXY（如 http://127.0.0.1:7890），或在下方 PROXY 直接填写
import { toUnicode, getEmojiCombo, googleRequestUrl } from 'emoji-mixer'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fs from 'node:fs'
import https from 'node:https'

// 代理地址：留空 '' 则用环境变量 HTTPS_PROXY；都没有则直连
const PROXY = ''

export class emojimix extends plugin {
  constructor () {
    super({
      name: 'emojimix-合成表情',
      dsc: '两个 emoji 合成一张表情图（Emoji Kitchen）',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#(合成|emojimix|emoji合成|表情合成)\\s*(.+)$',
          fnc: 'mix'
        }
      ]
    })
  }

  async mix (e) {
    // 提取两个 emoji
    const raw = e.msg.replace(/^#?(合成|emojimix|emoji合成|表情合成)\s*/, '').trim()
    const emojis = raw.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu) || []
    if (emojis.length < 2) {
      return this.reply('格式：\n#合成 😂 😭\n（需要两个 emoji，中间空格隔开）')
    }
    const [a, b] = [emojis[0], emojis[1]]

    // 转换 Unicode 码点（不支持的旧版 emoji 会抛异常）
    let ua, ub
    try {
      ua = toUnicode(a)
      ub = toUnicode(b)
    } catch (err) {
      logger.error('[emojimix] toUnicode error:', err)
      return this.reply(`「${a}」或「${b}」里有不受支持的表情，换一个试试`)
    }
    if (!ua || !ub) {
      const bad = !ua ? a : b
      return this.reply(`「${bad}」这个表情不受支持，换一个试试`)
    }

    // 生成合成图 URL（先预检组合是否存在，避免生成 404 链接）
    let url
    try {
      const combo = getEmojiCombo(ua, ub)
      if (!combo) {
        return this.reply(`「${a}」和「${b}」没有可用的合成组合，换两个试试`)
      }
      url = googleRequestUrl(combo)
    } catch (err) {
      logger.error('[emojimix] getEmojiCombo error:', err)
      return this.reply('合成失败（内部错误）')
    }

    // 下载图片
    const file = `${process.cwd()}/plugins/example/data/emojimix-${Date.now()}.png`
    try {
      await this.download(url, file)
    } catch (err) {
      logger.error('[emojimix] download error:', err)
      if (err && err.message === 'HTTP 404') {
        return this.reply(`「${a}」和「${b}」这个组合暂时没有图，换两个试试`)
      }
      return this.reply('图片下载失败，可能网络问题')
    }

    // 发送图片
    await this.reply(segment.image(file))
    // 清理临时文件
    setTimeout(() => {
      try { fs.unlinkSync(file) } catch {}
    }, 60000)
  }

  download (url, file) {
    return new Promise((resolve, reject) => {
      const proxy = PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || ''
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://emojikitchen.dev/',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
      }
      if (proxy) {
        options.agent = new HttpsProxyAgent(proxy)
        logger.info(`[emojimix] 使用代理: ${proxy}`)
      }
      const req = https.get(url, options, res => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error('HTTP ' + res.statusCode))
        }
        const ws = fs.createWriteStream(file)
        res.pipe(ws)
        ws.on('finish', () => ws.close(() => resolve()))
        ws.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(20000, () => { req.destroy(new Error('timeout')) })
    })
  }
}
