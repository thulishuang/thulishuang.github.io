# split-bills-data · 账本数据仓库

**这是 Splitwise 分账网站的"后台数据库"。** 网页通过 GitHub Contents API 直接读写这里的
`ledger.jsonl`——不需要云服务、不需要翻墙、免费、每一次同步都是一个可回滚的 commit。

> 仓库里**现在没有 `ledger.jsonl`**：本仓库是公开的，所以不留任何账本明文。
> 第一次在网页里点 **Sync now** 时文件会自动创建——如果你在 Data sync 填了
> Ledger passphrase，创建出来的就是**加密**文件；没填则是明文（公开仓库下不推荐）。

配套网站：<https://thulishuang.github.io/split-bills/>

## 常见问题：改成 private 还能用吗？

**能，而且应该这么做。** 关键是分清两个仓库，它们互不相干：

| 仓库 | 用途 | 能不能 private |
| --- | --- | --- |
| `thulishuang/thulishuang.github.io` | 托管**网页本身**（GitHub Pages） | **不能**。GitHub 免费版的 Pages 只支持公开仓库（私有仓库的 Pages 需要 GitHub Pro/Team 付费版）。好在它只放代码，没有私人数据 |
| `split-bills-data`（数据仓库） | 存放**账本 JSONL** | **能，而且推荐**。它**不需要 Pages**——网页是通过 GitHub Contents API 读写的，只要有 token，私有仓库照样能读写 |

> **隐私提醒**：目前账本文件放在 `thulishuang.github.io`（公开仓库）里，
> 意味着**任何人打开那个 URL 都能读到账本内容**。现在只有演示数据，没有真实账目。
>
> **放真实数据前，请按下面步骤切到私有仓库**（2 分钟）：
>
> 1. GitHub → New repository → 名字 `split-bills-data` → 选 **Private** → 创建
> 2. 网页 Account → Data sync → Repository 改成 `你的用户名/split-bills-data`，
>    File path 改成 `ledger.jsonl`
> 3. 保存后点 **Sync now**，网页会把账本写进私有仓库（首次写入会自动创建文件）
>
> token 用同一个即可（classic token 的 `repo` scope 同时覆盖公开和私有仓库）。
> 网页会自动检测仓库可见性：如果 Repository 指向的是公开仓库，
> Data sync 卡片里会显示橙色警告 **"This repository is public"**。

### 不想建私有仓库？填个口令就能加密

Data sync 里的 **Ledger passphrase**（可选）填上后，账本在提交前会被
**AES-256-GCM 加密**（PBKDF2-SHA256 派密钥，每次新 salt/iv），
仓库里只有密文，公开仓库也读不出内容。朋友们填同一个口令即可解密合并。

加密后的文件长这样（单行、自描述）：

```jsonl
{"enc":1,"kdf":"pbkdf2-sha256","iter":150000,"salt":"...","iv":"...","data":"<base64 密文>"}
```

> **没有恢复机制：口令丢了账本就找不回来**，请另行保存口令。
> 口令只存在各设备浏览器里，不随账本同步；改口令后下次同步会用新口令重写文件。

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
