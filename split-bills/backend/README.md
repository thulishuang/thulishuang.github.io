# 云端后端：三种免费方案

网页本身是纯静态的，数据默认存在浏览器 localStorage（换设备就没了）。
要「数据固定在云端、增删支出自动同步」，需要下面任意一个后端，
然后在网页 **Account → Data sync** 里填进去即可。

> 冲突策略：最后写入获胜（按 `updatedAt` 时间戳）。两台设备同时编辑时，
> 后同步的会覆盖先同步的——个人或小家庭单人记账场景够用。

---

## 方案 A：Google Apps Script（推荐，免费无需信用卡）

仓库里已写好现成代码：[`apps-script/Code.gs`](apps-script/Code.gs)

1. 打开 <https://script.google.com/> → 新建项目
2. 整段粘贴 `Code.gs`，保存
3. **部署 → 新部署 → 类型选「Web 应用」**
   - 执行身份：**我**
   - 可访问者：**所有人**
4. 复制生成的 URL（`https://script.google.com/macros/s/…/exec`）
5. 网页 Account → Data sync：
   - Storage mode 选 **Cloud REST endpoint**
   - Endpoint URL 粘贴该 URL
   - 自定义留空，保存 → 点 **Sync now**

之后每次新增 / 修改 / 删除支出、结算、评论，都会在 1.2 秒后自动推送；
打开网页时自动拉取云端最新数据。数据存在你自己 Google 账号的
ScriptProperties 里，URL 即凭证，别外传。

## 方案 B：LeanCloud（国内访问快，免费额度）

适合 Google 访问不稳定的场景。注册 <https://leancloud.cn> → 创建应用 →
{_} 数据存储 → 建一个 Class 叫 `Ledger`，放一条记录（内容随意），
记下 ObjectId。然后在 Account → Data sync 填：

- Endpoint URL：`https://<你的AppID>.api.lncldglobal.com/1.1/classes/Ledger/<ObjectId>`
- 自定义 header 名：`X-LC-Key`
- 自定义 header 值：`<你的AppKey>`

LeanCloud 的 REST API 原生支持 CORS 和自定义 header，网页的通用同步层可直接驱动。

## 方案 C：任何会存 JSON 的 REST 接口

同步层只要求两点，任何满足的服务都能用：

- `GET {url}?callback=xxx` 返回 `xxx({...账本JSON...})`（JSONP）
- `POST {url}` 请求体为整份账本 JSON，由服务端保存

比如自建的 Cloudflare Worker、Vercel Function、或任意 KV 存储网关。

---

## 不配云同步也能用

不填 Endpoint 时数据只存在当前浏览器，可用
Account → **Export full backup (JSON)** 导出、在新设备 **Import backup (JSON)** 导入，
做手动迁移。
