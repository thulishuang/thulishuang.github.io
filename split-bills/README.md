# Splitwise · 朋友分账记账

Splitwise 的网页复刻版：朋友旅行、聚餐、合租的分账记账。**UI 风格与功能完整复刻**
splitwise.com 的移动端 App（底部标签栏 + 悬浮添加按钮 + 全屏表单）和桌面网页端
（左侧边栏，≥960px 自动切换）。纯静态、零依赖、无需账号——打开输入名字和邮箱就能用。

> 非官方演示克隆，未连接 Splitwise 官方服务。

## GitHub Pages 地址

```text
https://thulishuang.github.io/split-bills/
```

已于 2026-10-20 从构建机 curl 验证：index.html 与 assets/ 下 4 个文件全部返回 200。
首次推送后 GitHub Pages 构建排队约 20 分钟才生效，之后推送一般 1-2 分钟。

## 数据存在哪里（重要）

GitHub Pages 是**静态托管，没有后台数据库**。默认数据存在**你自己浏览器的 localStorage**
（键名 `splitwise-clone-v1`）：

- 不经过任何服务器，不上传、不同步；断网也能正常记账查账（唯一外部请求是 Google Fonts，断网回退系统字体）
- 按浏览器 + 设备隔离：换手机 / 换浏览器 / 开无痕模式，数据互不相通
- **换设备迁移**：Account → Export full backup (JSON) 导出备份，在新设备上 Import backup (JSON) 导入
- **清缓存会丢数据**，重要账目请及时导出备份（或 Export expenses as CSV）
- **要真正的云端固定存储**：见下方「云同步」——配好端点后数据就在云端，换设备不丢

## 云同步（数据存 Git 仓库，换设备不丢）

Account → **Data sync** → Storage mode 选 `GitHub repo (JSONL file)`，Repository /
File path / Branch 已预填好（就是本仓库的 `split-bills-data/ledger.jsonl`），
**只需粘贴一个 GitHub token**，保存后点 Sync now。

之后每次新增 / 修改 / 删除支出、结算、评论都会在 1.2 秒内自动提交到仓库；
打开网页自动拉取；页面开着时每 60 秒检查一次，朋友的改动约 1 分钟内自动出现。
同步日志（push / pull / retry / error 带时间和数据量）就在 Data sync 卡片底部。

- **不需要云服务、不需要翻墙**：走 GitHub Contents API，国内可直连
- **多设备不丢**：记录级合并——两台设备各记各的，同步后两边的记录都在
- **可回滚**：每次同步都是一个 commit，改坏了回滚即可
- **token 怎么来**：github.com/settings/tokens → classic token → 勾选 `repo`，
  只存在你自己浏览器的 localStorage 里
- **给朋友用**：Data sync 有两个分享按钮——**Copy one-click link**（链接里带上你的
  token，朋友打开就能记账，零输入）和 **Copy plain link**（不带 token，朋友只能读，
  要记账得自己贴 token）。一键链接等于凭据，只发给信任的人，并建议用只授权这一个
  仓库的 fine-grained token
- **隐私 / private 仓库**：账本文件默认在公开仓库 `thulishuang.github.io` 里
  （目前只有演示数据）。**放真实数据前请建一个 Private 仓库**——数据仓库不需要
  Pages，靠 GitHub API 读写，私有仓库完全正常；而托管网页的
  `thulishuang.github.io` 必须保持公开（GitHub 免费版 Pages 只支持公开仓库，
  私有仓库的 Pages 要付费版），但它只放代码没有私人数据。
  网页会自动检测：Repository 指向公开仓库时，Data sync 卡片会显示
  **"This repository is public"** 警告。切换步骤见
  [`split-bills-data/README.md`](../split-bills-data/README.md)

详细说明（含文件格式、合并规则、多账本）见
[`split-bills-data/README.md`](../split-bills-data/README.md)。

## 本地预览

```bash
cd /data/thulishuang.github.io/split-bills
python3 -m http.server 8788
# 打开 http://127.0.0.1:8788/
```

## 更新发布

改动 `assets/` 下的文件后提交推到 `main`，GitHub Pages 自动重建（约 1 分钟）：

```bash
git add split-bills/
git commit -m "Update split-bills"
git push
```

## 源码与测试

完整项目（含 206 项自动化测试）在 `/data/hackathon-air-bot/splitwise-web/`，
`dist/` 与本目录内容一致（仅资源路径改为 `assets/`）。
