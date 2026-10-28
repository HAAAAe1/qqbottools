# qqbottools

自用的**通用** [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 插件集合，按功能分类归档。

FF14 相关插件不在这里，见 [qqbotff14](https://github.com/HAAAAe1/qqbotff14)。

跑在个人 QQ + 协议端（OneBot v11，非官方 Bot API）上，**没有做过多适配，直接拿去用可能需要改**。写的时候都是按本机环境实测的。

---

## 插件清单

| 目录 | 插件 | 命令 | 依赖 |
|---|---|---|---|
| [`plugins/help`](plugins/help) | 功能菜单（转发图） | `#help` | puppeteer（渲染图） |
| [`plugins/group-summary`](plugins/group-summary) | 群聊总结 | `#总结 [条数]` | DeepSeek API |
| [`plugins/context-recycle`](plugins/context-recycle) | AI 会话闲置自动轮换 | 自动　`#清理闲置会话` | sqlite3 + chatgpt-plugin |
| [`plugins/voice-music`](plugins/voice-music) | 本地曲库语音放歌 | `#放首歌`　`#放整首 歌名`　`#音乐 歌名 [秒]`　`#放首哈基米歌`　`#放首完整哈基米歌` | 无（ffmpeg） |
| [`plugins/slot-machine`](plugins/slot-machine) | 耄耋机（挖矿 + 冒险） | `#耄耋机挖矿`　`#耄耋机冒险`　`#冒险状态`　`#冒险排行` | 无（纯本地） |
| [`plugins/greet`](plugins/greet) | 单独 @ 机器人时打招呼 | `@机器人`（无文字、无引用） | 无 |
| [`plugins/emojimix`](plugins/emojimix) | emoji 合成（Emoji Kitchen） | `#合成 😂 😭`　`#emojimix 😀 😀` | 需代理访问 Google |
| [`plugins/set-group-card`](plugins/set-group-card) | 设置机器人群名片 | `#设置名片 名字` | 无 |
| [`plugins/repeat`](plugins/repeat) | 复读并撤回 | `#复读` | 无 |
| [`plugins/notice`](plugins/notice) | 入群欢迎 / 退群通知 | `#欢迎新人 开启`　`#退群通知 开启`　`#通知设置` | 无 |

命令速查见 [`docs/命令速查.md`](docs/命令速查.md)。

---

## 安装

本仓库按功能分目录，**插件文件里的相对路径没有改**（都还是 `../../lib/plugins/plugin.js`），所以放进 Yunzai 时要**平铺到 `plugins/example/`**：

```bash
git clone https://github.com/HAAAAe1/qqbottools.git
cd qqbottools

# 按需复制，不要整个目录塞进去
cp plugins/group-summary/GroupSummary.js  /path/to/TRSS-Yunzai/plugins/example/
cp plugins/voice-music/voice-music.js     /path/to/TRSS-Yunzai/plugins/example/
cp plugins/slot-machine/slot-machine.js   /path/to/TRSS-Yunzai/plugins/example/

# help 有资源目录，要连 resources 一起铺
cp -r plugins/help/help.js plugins/help/resources  /path/to/TRSS-Yunzai/plugins/example/
```

放好后 Yunzai 的 watcher 会自动 `[新增插件]`，**不用重启**。但如果动了 `utils/` 或 `apps/` 就必须重启。

⚠️ 两个插件写死了 `plugins/example/` 路径（`emojimix.js` 的临时图、`context-recycle.js` 的 DB），挪到别的子目录会失效。

---

## 各插件配置

### group-summary

`#总结` 调 DeepSeek 官方 API。key 不进仓库，二选一：

```bash
# 方式一：环境变量
export DEEPSEEK_API_KEY=sk-xxxxxxxx

# 方式二：本地文件
echo '{"apiKey":"sk-xxxxxxxx"}' > plugins/example/data/deepseek.json
```

没有配置时插件不会报错，只是跳过 AI 总结。

### slot-machine

管理命令需要管理员 QQ 列表，同样二选一：

```bash
export QQBOT_ADMINS=123456,789012
# 或
echo '["123456","789012"]' > plugins/example/data/admins.json
```

> 老虎机 / 对战 / 欠款玩法在 2026-09-28 因封号风险已注释停用，当前只保留「挖矿」和「冒险」。

### voice-music

曲库目录默认 `D:/QQBot/music`，哈基米曲库 `D:/QQBot/music-hajimi`，可用环境变量 `VOICE_MUSIC_DIR` / `HAJIMI_MUSIC_DIR` 覆盖。

支持 mp3 / flac / wav / m4a / ogg / aac / wma / opus / ape。QQ 语音上限约 60 秒，所以「整首」会按 60 秒拆成多条依次发。

### context-recycle

依赖 `plugins/chatgpt-plugin/data/data.db`，换了插件目录要改 `DB_PATH`。闲置 2 小时自动结束对话，避免上下文无限增长。

### emojimix

要访问 Google 的 Emoji Kitchen，国内需要代理。改文件顶部 `PROXY` 常量，或设环境变量 `HTTPS_PROXY`。

### help

`resources/help/guoba-help.jpg` 是土块插件的帮助图（随仓库提供）。`resources/workbuddy-invite-poster.png` **没有入库**（私人邀请海报），代码里用 `fs.existsSync` 判断，缺了不影响运行。

`#help` 里的 FF14 菜单块是硬编码文案，跟 qqbotff14 的插件是两套东西，改命令时两边都要动。

---

## 数据文件

运行后会在 `plugins/example/data/` 下生成，**都不入库**：

| 文件 | 用途 |
|---|---|
| `voice-hooks.json` | 高潮标注（按文件路径 + mtime，文件变了自动失效） |
| `slot-data.json` | 耄耋机余额、挖矿记录、冒险进度 |
| `notice-switch.json` | 各群欢迎 / 退群通知开关 |
| `deepseek.json` | DeepSeek key（你自己建） |
| `admins.json` | 管理员 QQ（你自己建） |

---

## 免责声明

个人自用代码，不保证通用性。耄耋机是纯虚拟币娱乐，不涉及任何真实财物。语音放歌功能放的是本地文件，注意自己曲库的版权。

## 致谢

- [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai)
- [Emoji Kitchen](https://emojikitchen.dev/) / emoji-mixer
- DeepSeek API
