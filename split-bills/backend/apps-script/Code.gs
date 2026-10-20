/**
 * Splitwise clone — 分账数据云端后端（Google Apps Script Web App）
 *
 * 免费、无需信用卡、5 分钟部署。部署后得到一个 URL，填到网页
 * Account → Data sync → Endpoint URL 即可多设备同步。
 * 支持「房间」：同一 URL 下不同 room 各存一份账本，互不干扰——
 * 朋友各自的活动填不同 room 即可，分享链接时自动带上 room。
 *
 * 部署步骤：
 *   1. 打开 https://script.google.com/ → 新项目
 *   2. 整段粘贴本文件，保存
 *   3. 部署 → 新部署 → 类型选 "Web 应用"
 *        - 执行身份：我
 *        - 可访问者：所有人
 *   4. 复制 "Web 应用 URL"（https://script.google.com/macros/s/…/exec）
 *      填到网页 Account → Data sync → Endpoint URL，保存后点 Sync now
 *   5. 想让朋友直接用：在 Data sync 里填个 Room（如 japan2026），
 *      点 "Copy share link" 把链接发给朋友——他们打开就自动配好同步
 *
 * 数据存哪：脚本的 ScriptProperties，每房间一个键（ledger:<room>）。
 * 单值上限约 500KB，日常记账足够；收据图片会占空间，云同步模式下
 * 网页已把单张图片限制在 150KB。
 * 隐私：URL 即凭证，谁拿到谁能读写所有房间；room 名是唯一隔离，别外传。
 * 额度：Web 应用请求 20,000 次/天，网页每 60 秒最多拉取一次，个人使用远低于上限。
 */

var PROP_PREFIX = 'ledger:';
var MAX_BYTES = 900000; // 超出即拒绝，保护属性存储上限
var ROOM_RE = /^[a-zA-Z0-9_-]{1,40}$/;

function roomOf(e) {
  var r = (e && e.parameter && e.parameter.room) || '';
  if (!ROOM_RE.test(r)) r = 'default';
  return r;
}

function roomOfPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var r = data.room || '';
    if (!ROOM_RE.test(r)) r = 'default';
    return r;
  } catch (err) {
    return 'default';
  }
}

/** GET：JSONP 返回该房间的账本快照（网页用 <script> 拉取，绕开 CORS） */
function doGet(e) {
  var cb = (e && e.parameter && e.parameter.callback) || 'callback';
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_PREFIX + roomOf(e));
  var out = raw || '{}';
  return ContentService
    .createTextOutput(cb + '(' + out + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** POST：保存整份账本 JSON 到该房间（网页以 text/plain 简单请求发送，免预检） */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (!body) return json({ ok: false, error: 'empty body' });
    if (body.length > MAX_BYTES) return json({ ok: false, error: 'payload too large' });
    var data = JSON.parse(body);
    if (!data || typeof data !== 'object' || data.version !== 1 || !data.users || !data.groups) {
      return json({ ok: false, error: 'bad payload' });
    }
    var room = roomOfPost(e);
    PropertiesService.getScriptProperties().setProperty(PROP_PREFIX + room, body);
    return json({ ok: true, room: room, savedAt: new Date().toISOString(), bytes: body.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 在编辑器里手动运行，确认写入正常 */
function testWrite() {
  PropertiesService.getScriptProperties().setProperty(
    PROP_PREFIX + 'default',
    JSON.stringify({ version: 1, users: {}, groups: [], expenses: [], updatedAt: new Date().toISOString() }));
}

/** 查看所有房间的数据大小（字节） */
function inspectRooms() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var total = 0;
  for (var k in props) {
    if (k.indexOf(PROP_PREFIX) === 0) {
      Logger.log(k + ' -> ' + props[k].length + ' bytes');
      total += props[k].length;
    }
  }
  Logger.log('total: ' + total + ' bytes');
  return total;
}
