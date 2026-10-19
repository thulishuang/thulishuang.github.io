# Splitwise · 朋友分账记账

Splitwise 的网页复刻版：朋友旅行、聚餐、合租的分账记账。**UI 风格与功能完整复刻**
splitwise.com 的移动端 App（底部标签栏 + 悬浮添加按钮 + 全屏表单）和桌面网页端
（左侧边栏，≥960px 自动切换）。纯静态、零依赖、无需登录——打开输入名字就能用。

> 非官方演示克隆，未连接 Splitwise 官方服务。

## GitHub Pages 地址

```text
https://thulishuang.github.io/split-bills/
```

已于 2026-10-20 从构建机 curl 验证：index.html 与 assets/ 下 4 个文件全部返回 200。
首次推送后 GitHub Pages 构建排队约 20 分钟才生效，之后推送一般 1-2 分钟。

## 数据存在哪里（重要）

GitHub Pages 和 StepPage 一样是**静态托管，没有后台数据库**。本页面的全部数据只存在
**你自己浏览器的 localStorage**（键名 `splitwise-clone-v1`）：

- 不经过任何服务器，不上传、不同步；断网也能正常记账查账（唯一外部请求是 Google Fonts，断网回退系统字体）
- 按浏览器 + 设备隔离：换手机 / 换浏览器 / 开无痕模式，数据互不相通
- **换设备迁移**：Account → Export full backup (JSON) 导出备份，在新设备上 Import backup (JSON) 导入
- **清缓存会丢数据**，重要账目请及时导出备份（或 Export expenses as CSV）

## 功能

- **入口**：只问名字，无账号无密码；可选「带演示数据进入」或「空白账本开始」
- **分账**：五种方式——平均分摊 / 精确金额 / 百分比 / 份额 / 调整；平均分摊余数逐分分配
- **账本与好友**：建群（名称 / emoji / 货币 / 成员）、加好友（双人账本）、邀请链接
- **结算**：Settle up（方向、金额、支付方式）、Simplify debts 最小转账笔数算法
- **查询**：总余额仪表盘、群组 / 好友余额、Activity 动态流（按日分组、类型过滤）、
  All expenses 搜索 + 筛选、Charts & totals（近 6 个月柱状图 / 分类占比）、周期账
- **货币**：14 种货币，群级货币 + 默认货币，总余额自动换算（静态参考汇率）
- **其他**：21 个分类图标、支出评论、收据图片（本地）、深色模式、CSV / JSON 导出导入

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
