# split-bills-data · 账本数据仓库

**这是 Splitwise 分账网站的"后台数据库"。** 网页通过 GitHub Contents API 直接读写这里的
`ledger.jsonl`——不需要云服务、不需要翻墙、免费、每一次同步都是一个可回滚的 commit。

配套网站：<https://thulishuang.github.io/split-bills/>

> **隐私提醒**：这个文件在 `thulishuang.github.io` 仓库里，而该仓库是公开的，
> 意味着**任何人打开这个 URL 都能读到你的账本**。目前里面只有演示数据，没有真实账目。
>
> 要放真实数据，请建一个 **私有仓库**（GitHub → New repository → **Private** →
> 名字如 `split-bills-data`），然后把网页 Account → Data sync 里的 Repository 改成
> `你的用户名/split-bills-data`、File path 改成 `ledger.jsonl`，保存后点 Sync now，
> 网页会把账本写进私有仓库。token 用同一个即可。

## 文件格式

`ledger.jsonl` 是 **JSON Lines**：一行一条记录。`t` 字段指明集合：

```jsonl
{"t":"user","id":"u_1vd7s6s","name":"Alex Morgan","email":"alex@example.com","color":"#F96817","updatedAt":"..."}
{"t":"group","id":"g_trip","kind":"group","name":"Japan Trip 2026","currency":"JPY","members":[...],"simplifyDebts":true,"updatedAt":"..."}
{"t":"expense","id":"e1","groupId":"g_trip","description":"Ramen dinner","amountCents":820000,"currency":"JPY","paidBy":"u_emma","splits":[...],"updatedAt":"..."}
{"t":"payment",...}
{"t":"comment",...}
{"t":"recurring",...}
```

**合并规则**（网页拉取时按此折叠整个文件）：

1. 同一 `(t, id)` 只保留 `updatedAt` 最新的那条
2. `deleted: true` 视为已删除，但**保留在文件里**——这样删除才能同步给其他设备
3. 金额单位是**分**（整数），`amountCents: 820000` = ¥8,200.00

所以两台设备各记各的不会互相覆盖；同一行记录则是时间戳新的赢。

## 接入网页（2 分钟）

1. **建 token**：<https://github.com/settings/tokens> → Generate new token (classic)
   → 勾选 **`repo`** 这一个 scope → 生成后复制（`ghp_` 开头，只显示一次）
2. 打开 <https://thulishuang.github.io/split-bills/> → **Account → Data sync**
3. Storage mode 选 **GitHub repo (JSONL file)**。Repository / File path / Branch
   已经预填好（就是本仓库和本文件），**只需要粘贴 token**
4. 点 **Save sync settings** → 网页自动测试并合并仓库里的账本

之后：每次新增 / 修改 / 删除支出，1.2 秒后自动提交；打开网页自动拉取；
页面开着时每 60 秒检查一次。同步日志在 Account → Data sync 卡片底部
（push / pull / retry / error 各带时间和数据量，同步正不正常直接看那里）。

**换设备**：新设备上填同样四项即可（token 存在各设备自己的浏览器里，不随账本同步）。

**给朋友用**：Account → Data sync → **Copy share link** 生成
`…/#ghrepo=…&ghpath=…&ghbranch=…` 链接（**不含 token**），朋友打开就配好了仓库，
粘贴他自己的 token 就能一起记账。

## 多个账本（互不干扰）

想给不同朋友圈各一本账：复制这个文件成 `ledger-japan.jsonl`、`ledger-apt.jsonl`，
在网页的 File path 里填对应文件名即可。一个仓库可以放很多本账。

## 手动编辑 / 修复

可以直接在 GitHub 网页上编辑 `ledger.jsonl`（或 git 推送），网页下次同步就会采用。
改坏了就回滚到上一个 commit——这就是用 git 仓库当数据库的好处。

## 速率限制

GitHub API 带 token 是 5000 次/小时，每次同步 = 1 读 + 1 写。几个人用远低于限制；
如果日志出现 `rate limit`，会提示什么时候恢复。
