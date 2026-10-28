// greet.js - 单独 @机器人 时打招呼
// 用法：群里单独 @机器人（不带任何文字、不引用任何消息）→ 弹欢迎语
//
// 2026-10-13 14:46 变更（按用户要求）：
//  1) 欢迎语改成 bot414（圆头耄耋）的语气 —— 暴躁橘猫、自称「你耋」、不耐烦、爱答不理。
//     原来的文案是客服腔（「你好呀～」「可以帮你：」），跟人设严重打架。
//  2) 修 bug：原来只检查 e.msg 是否为空，但**引用消息时 e.msg 同样是空字符串**
//     （CQ:reply 和 CQ:at 都会被 Yunzai 剥离），导致「@bot + 引用某条消息」
//     被误判成「纯@无内容」→ 抢先弹欢迎语并 return true 拦截，引用内容根本进不了模型。
//     修法：加 e.source / e.reply_id 判断 —— 有引用就不算「纯@」，放行给 chatgpt-plugin。
export class greet extends plugin {
  constructor () {
    super({
      name: '打招呼',
      dsc: '单独@机器人时打招呼；带引用或带内容时不拦截',
      event: 'message',
      priority: 100, // 高优先级，先于 chatgpt-plugin(555500) 处理
      rule: [
        { reg: '^\\s*$', fnc: 'greet', permission: 'all' }
      ]
    })
  }

  async greet (e) {
    // 仅群里、且确实 @了机器人（atBot 由 loader 解析）
    if (!e.isGroup || !e.atBot) return false
    // 有引用 → 不是「纯@」，交给 chatgpt 处理引用内容（修 2026-10-13 的误判 bug）
    if (e.source || e.reply_id) return false
    // 确保消息里没有其他内容（纯 @，无文字/图片/文件等）
    if (e.msg && e.msg.trim()) return false
    if (e.img?.length) return false
    if (e.message?.some(i => i.type === 'file')) return false

    // 欢迎语（bot414 / 圆头耄耋 语气）
    const reply = [
      `哈！${e.sender?.card || e.sender?.nickname || '两脚兽'}。`,
      '你耋是 414bot，能干的活儿都在这：',
      '超多ff14工具',
      '一些趣味功能',
      '想看完整菜单，发送 #help 即可'
    ].join('\n')

    await e.reply(reply)
    return true // 拦截，不再交给其他插件（如 chatgpt）
  }
}
