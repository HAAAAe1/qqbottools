export class setGroupCard extends plugin {
  constructor() {
    super({
      name: "设置群名片",
      dsc: "设置机器人的群名片（用法：#设置名片 名字）",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#设置名片\\s*(.*)$",
          fnc: "setCard",
          permission: "all"
        }
      ]
    })
  }

  async setCard() {
    const card = this.e.msg.replace(/^#设置名片\s*/, "").trim()
    if (!card) return this.reply("用法：#设置名片 名字")
    try {
      const bot = this.e.bot
      if (typeof bot.setCard === "function") {
        await bot.setCard(this.e.self_id, card)
      } else {
        await bot.sendApi("set_group_card", {
          group_id: this.e.group_id,
          user_id: this.e.self_id,
          card
        })
      }
      this.reply(`已设置群名片：${card}`)
    } catch (err) {
      this.reply(`设置失败：${err.message}`)
    }
  }
}
