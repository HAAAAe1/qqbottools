export class example2 extends plugin {
  constructor() {
    super({
      name: "复读",
      dsc: "复读用户发送的内容（含风控检测），然后撤回",
      /** https://oicqjs.github.io/oicq/#events */
      event: "message",
      priority: 5000,
      rule: [
        {
          /** 命令正则匹配 */
          reg: "^#复读$",
          /** 执行方法 */
          fnc: "repeat",
          /** 所有人可用 */
          permission: "all",
        },
      ],
    })
  }

  /** 复读 */
  async repeat() {
    /** 设置上下文，后续接收到内容会执行doRep方法 */
    this.setContext("doRep")
    /** 回复 */
    return this.reply("请发送要复读的内容", false, { at: true })
  }

  /** 接受内容 */
  doRep() {
    this.finish("doRep")
    /** 提取文本段做风控检测 */
    const text = (this.e.message || [])
      .filter(m => m.type === "text")
      .map(m => m.text)
      .join("")
    if (checkRisk(text)) {
      return this.reply("这条内容不合适复读，跳过啦", false, { at: true })
    }
    /** 复读内容 */
    return this.reply(this.e.message, false, { recallMsg: 5 })
  }
}

/**
 * 风控检测：命中任一规则即拒绝复读
 * QQ 对营销广告、诈骗、赌博、色情、违禁品、政治敏感内容的刷屏/复读封号风险极高
 * 需要增删词库直接编辑下面的数组即可（保存后热加载生效）
 */
const RISK_WORDS = [
  // —— 诈骗 / 资金 ——
  "银行卡号", "转账", "汇款", "验证码", "刷单", "兼职日结", "稳赚不赔",
  "内幕消息", "带你赚钱", "投资返利", "高额回报", "博彩", "彩票", "赌场",
  "开户送", "跑分", "洗钱", "套现", "贷款秒批", "裸贷",
  // —— 广告引流（复读广告=封号高发区）——
  "加微信", "加我微信", "V信", "薇信", "加QQ群", "扫码领", "免费送",
  "点击链接", "注册送", "限时秒杀", "拼多多砍价", "刷赞", "刷粉", "代购",
  // —— 违禁品 / 违法 ——
  "毒品", "冰毒", "海洛因", "大麻", "枪支", "弹药", "炸药", "卖淫",
  "嫖娼", "迷药", "假钞", "代开发票", "办证", "作弊器", "外挂",
  // —— 色情低俗 ——
  "裸聊", "约炮", "黄色网站", "色情片", "AV资源", "福利姬",
  // —— 政治敏感 ——
  "法轮功", "六四", "天安门事件", "藏独", "疆独", "东突厥斯坦",
]

/** 检测：命中敏感词或含链接 → 拒绝复读 */
function checkRisk(text) {
  if (!text) return false
  /** 链接是广告复读重灾区，一律拒绝 */
  if (/https?:\/\/|www\./i.test(text)) return true
  return RISK_WORDS.some(w => text.includes(w))
}
