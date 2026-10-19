/**
 * Splitwise clone — 分账数据云端后端（Google Apps Script Web App）
 *
 * 免费、无需信用卡、5 分钟部署。部署后得到一个 URL，填到网页
 * Account → Data sync → Endpoint URL 即可多设备同步。
 *
 * 部署步骤：
 *   1. 打开 https://script.google.com/ → 新项目
 *   2. 整段粘贴本文件，保存
 *   3. 项目设置 → 勾选 "Show appscript.json"（一般已默认）
 *   4. 部署 → 新部署 → 类型选 "Web 应用"
 *        - 执行身份：我
 *        - 可访问者：所有人
 *   5. 复制 "Web 应用 URL"（https://script.google.com/macros/s/…/exec）
 *      填到网页 Account → Data sync → Endpoint URL，保存后点 Sync now
 *
 * 数据存哪：脚本的 ScriptProperties（单键 ledger，上限约 500KB，
 * 足够几十万条记账之外的日常使用；收据图片会占空间，云同步模式下
 * 网页已把单张图片限制在 150KB）。
 * 隐私：URL 即凭证，谁拿到谁能读写，别外传；数据在你自己 Google 账号里。
 */

var PROP_KEY = 'ledger';
var MAX_BYTES = 900000; // 超出即拒绝，保护属性存储上限

/** GET：JSONP 返回账本快照（网页用 <script> 拉取，绕开 CORS） */
function doGet(e) {
  var cb = (e && e.parameter && e.parameter.callback) || 'callback';
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  var out = raw || '{}';
  return ContentService
    .createTextOutput(cb + '(' + out + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** POST：保存整份账本 JSON（网页以 text/plain 简单请求发送，免预检） */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (!body) return json({ ok: false, error: 'empty body' });
    if (body.length > MAX_BYTES) return json({ ok: false, error: 'payload too large' });
    var data = JSON.parse(body);
    if (!data || typeof data !== 'object' || data.version !== 1 || !data.users || !data.groups) {
      return json({ ok: false, error: 'bad payload' });
    }
    PropertiesService.getScriptProperties().setProperty(PROP_KEY, body);
    return json({ ok: true, savedAt: new Date().toISOString(), bytes: body.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 在编辑器里手动运行一次，确认写入正常 */
function testWrite() {
  PropertiesService.getScriptProperties().setProperty(
    PROP_KEY, JSON.stringify({ version: 1, users: {}, groups: [], expenses: [], updatedAt: new Date().toISOString() }));
}

/** 查看当前云端数据大小（字节） */
function inspectSize() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY) || '';
  Logger.log('ledger bytes: ' + raw.length);
  return raw.length;
}
