# 农行信用卡机场贵宾厅查询

一个无需后端数据库的静态网页，用于查询农行信用卡境内 / 境外机场贵宾厅位置。


## GitHub Pages 地址

部署到 `thulishuang/thulishuang.github.io` 仓库后，访问：

```text
https://thulishuang.github.io/agbank-lounge-finder/
```

GitHub Pages 是静态托管，没有后端代理；实时更新建议使用仓库根目录的 GitHub Actions 工作流 `.github/workflows/update-agbank-lounges.yml` 定时重建 `data/lounges.json`。

## 当前内置数据

- 境外：来自 `../W020260702557021741944.xlsx`，共 1,024 条。
- 境内：来自参考页的结构化数据 `_ref/domestic.html`，共 81 条。
- 合计：1,105 条位置记录，580 个机场 / 站点。

> `../W020160629527440020250.xls` 是 2016 年旧版境内服务指南，字段老、含内部联系人信息，默认没有作为当前数据源使用。

## 本地预览

```bash
cd /Users/jyxc-dz-0101309/Documents/me/code/agbank-lounge-finder
python3 -m http.server 8788
```

浏览器打开：

```text
http://localhost:8788
```

## 重新生成内置 JSON

如果本地 Excel 或参考 HTML 更新了：

```bash
cd /Users/jyxc-dz-0101309/Documents/me/code/agbank-lounge-finder
python3 scripts/build_data.py
```

如果要从 URL 拉取最新境外 Excel 与境内结构化参考页：

```bash
python3 scripts/build_data.py \
  --auto-overseas-url \
  --domestic-html-url https://agbank-visa-lounge-finder.pages.dev/agbank_visa_domestic_lounge_finder
```

输出文件：

```text
data/lounges.json
```

## 通过 URL 实时更新

页面支持以下方式：

1. 在“通过 URL 更新数据”里填入 URL 并点击加载。
2. 在地址栏使用参数：

```text
?dataUrl=https://example.com/lounges.json
?overseasUrl=https://example.com/W020xxxx.xlsx
?domesticUrl=https://example.com/domestic.html
```

支持的源：

- JSON：完整 `lounges.json` 或记录数组。
- XLSX：按农行境外贵宾厅 Excel 的字段解析。
- HTML：页面内包含 `<script id="lounge-data" type="application/json">...</script>`。

注意：浏览器直接读取第三方 URL 可能遇到 CORS。部署到 Cloudflare Pages 后，项目里的 `functions/proxy.js` 会对允许域名提供 `/proxy?url=...` 中转。

## 部署到 Cloudflare Pages

不需要自有域名，Cloudflare 会分配 `*.pages.dev` 地址。

### 方案 A：GitHub + Cloudflare Pages

1. 把 `agbank-lounge-finder` 目录推到 GitHub 仓库。
2. Cloudflare Pages 选择该仓库。
3. Build command 留空。
4. Build output directory 填 `/` 或项目根目录。
5. 部署后即可访问 `https://<project>.pages.dev`。

### 方案 B：Wrangler 命令行

```bash
cd /Users/jyxc-dz-0101309/Documents/me/code/agbank-lounge-finder
npx wrangler pages deploy . --project-name agbank-lounge-finder
```

首次使用需要按提示登录 Cloudflare。


## 部署到 thulishuang.github.io

放在用户主页仓库 `thulishuang/thulishuang.github.io` 的 `agbank-lounge-finder/` 子目录后，访问地址是：

```text
https://thulishuang.github.io/agbank-lounge-finder/
```

GitHub Pages 只提供静态托管，没有 Cloudflare Pages Functions 这种代理能力。因此浏览器里直接刷新农行官网 Excel 可能会被 CORS 拦截。仓库根目录已准备一个 GitHub Actions 工作流：

```text
.github/workflows/update-agbank-lounges.yml
```

它可以手动运行，也会每日定时从 URL 拉取数据并更新 `agbank-lounge-finder/data/lounges.json`。

## 微信小程序方案

建议先用这个 H5 页面。若后续一定要小程序：

- 需要微信小程序 AppID。
- 需要配置合法 HTTPS 业务域名。
- 可以用小程序 `web-view` 嵌入本页面，或把本页面逻辑改写为原生小程序页面。

## 免责声明

机场贵宾厅位置、服务时间、权益次数、携伴规则可能变化；请以农行掌银、权益二维码、农行公告和机场现场为准。
