(() => {
  const DEFAULT_DATA_URL = 'data/lounges.json';
  const OFFICIAL_OVERSEAS_XLSX = 'https://www.abchina.com/cn/personalservices/abcpromotion/National/W020260702557021741944.xlsx';
  const DOMESTIC_REFERENCE_HTML = 'https://agbank-visa-lounge-finder.pages.dev/agbank_visa_domestic_lounge_finder';
  const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const PAGE_SIZE = 80;

  const $ = (id) => document.getElementById(id);
  const number = new Intl.NumberFormat('zh-CN');
  const filterKeys = ['scope', 'region', 'country', 'city', 'airport', 'terminal', 'security', 'departure'];
  const filterEls = Object.fromEntries([...filterKeys, 'sort'].map((id) => [id, $(id)]));

  let defaultBundle = null;
  let activeBundle = null;
  let records = [];
  let filteredRecords = [];
  let toastTimer = 0;
  const state = {
    q: '',
    scope: '境内',
    region: '上海',
    country: '中国',
    city: '上海',
    airport: '',
    terminal: '',
    security: '',
    departure: '',
    sort: 'default',
    visible: PAGE_SIZE,
  };

  function clean(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/\u3000/g, ' ')
      .replace(/[ \t]*\r?\n[ \t]*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitList(value) {
    return clean(value).split(/[,，、/]+/).map((x) => x.trim()).filter(Boolean);
  }

  function makeSearchText(row) {
    return [
      row.scope, row.continent, row.country, row.province, row.city, row.airport,
      row.iata, row.terminal, row.lounge, row.departure, row.security, row.directions,
      row.serviceTime, row.usage, row.serviceContent, row.guestPolicy, row.note,
    ].map(clean).join(' ').toLowerCase();
  }

  function normalizeRecord(row, prefix = 'R', index = 1) {
    const record = {
      id: clean(row.id) || `${prefix}${index}`,
      scope: clean(row.scope),
      continent: clean(row.continent),
      country: clean(row.country),
      province: clean(row.province),
      city: clean(row.city),
      airport: clean(row.airport),
      iata: clean(row.iata),
      terminal: clean(row.terminal),
      lounge: clean(row.lounge),
      departure: clean(row.departure),
      departureList: Array.isArray(row.departureList) ? row.departureList.map(clean).filter(Boolean) : splitList(row.departure),
      security: clean(row.security),
      directions: clean(row.directions),
      serviceTime: clean(row.serviceTime),
      usage: clean(row.usage),
      serviceContent: clean(row.serviceContent),
      guestPolicy: clean(row.guestPolicy),
      note: clean(row.note),
      airportNumber: row.airportNumber ?? '',
      locationNumber: row.locationNumber ?? '',
      source: clean(row.source),
    };
    if (!record.scope) record.scope = record.province || record.country === '中国' ? '境内' : '境外';
    if (record.scope === '境内') {
      record.country ||= '中国';
      record.continent ||= '中国';
    }
    record.lounge ||= record.scope === '境内' ? '机场贵宾厅/休息室' : '贵宾厅/休息室';
    record.searchText = makeSearchText(record);
    return record;
  }

  function normalizeBundle(payload, sourceName = 'URL 数据') {
    const rawRecords = Array.isArray(payload) ? payload : (payload.records || payload.data || []);
    if (!Array.isArray(rawRecords)) throw new Error('JSON 中未找到 records 数组');
    const normalized = rawRecords.map((row, i) => normalizeRecord(row, row.scope === '境内' ? 'D' : 'O', i + 1));
    return {
      metadata: {
        title: payload.metadata?.title || '农行信用卡机场贵宾厅查询',
        generatedAt: payload.metadata?.generatedAt || new Date().toISOString(),
        sources: payload.metadata?.sources || { runtime: { note: sourceName } },
        runtimeSource: sourceName,
      },
      records: normalized,
    };
  }

  function getField(row, key) {
    if (key === 'region') return row.scope === '境内' ? row.province : row.continent;
    if (key === 'departure') return row.departure;
    return row[key] || '';
  }

  function uniqueSorted(values) {
    return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  function rowMatches(row, exceptKey = '') {
    if (exceptKey !== 'q' && state.q) {
      const tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.every((token) => row.searchText.includes(token))) return false;
    }
    for (const key of filterKeys) {
      if (key === exceptKey) continue;
      const selected = state[key];
      if (!selected) continue;
      if (key === 'departure') {
        const list = row.departureList?.length ? row.departureList : splitList(row.departure);
        if (!list.includes(selected) && row.departure !== selected) return false;
      } else if (getField(row, key) !== selected) {
        return false;
      }
    }
    return true;
  }

  function sortRows(rows) {
    const fields = {
      default: ['scope', 'airportNumber', 'locationNumber', 'continent', 'country', 'province', 'city', 'airport', 'terminal'],
      airport: ['airport', 'iata', 'terminal', 'lounge'],
      city: ['scope', 'continent', 'country', 'province', 'city', 'airport'],
      scope: ['scope', 'region', 'country', 'city', 'airport'],
    }[state.sort] || [];
    return [...rows].sort((a, b) => {
      for (const f of fields) {
        const av = f === 'region' ? getField(a, 'region') : a[f];
        const bv = f === 'region' ? getField(b, 'region') : b[f];
        if (typeof av === 'number' && typeof bv === 'number' && av !== bv) return av - bv;
        const cmp = clean(av).localeCompare(clean(bv), 'zh-Hans-CN', { numeric: true });
        if (cmp) return cmp;
      }
      return 0;
    });
  }

  function populateSelect(id, options, label) {
    const el = filterEls[id];
    const current = state[id];
    el.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = `全部${label ? ` ${label}` : ''}`;
    el.appendChild(all);
    for (const value of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      el.appendChild(opt);
    }
    if (current && options.includes(current)) {
      el.value = current;
    } else {
      state[id] = '';
      el.value = '';
    }
  }

  function updateFilterOptions() {
    populateSelect('scope', uniqueSorted(records.map((r) => r.scope)), '范围');
    populateSelect('region', uniqueSorted(records.filter((r) => rowMatches(r, 'region')).map((r) => getField(r, 'region'))), '洲/省份');
    populateSelect('country', uniqueSorted(records.filter((r) => rowMatches(r, 'country')).map((r) => r.country)), '国家/地区');
    populateSelect('city', uniqueSorted(records.filter((r) => rowMatches(r, 'city')).map((r) => r.city)), '城市');
    populateSelect('airport', uniqueSorted(records.filter((r) => rowMatches(r, 'airport')).map((r) => r.airport)), '机场');
    populateSelect('terminal', uniqueSorted(records.filter((r) => rowMatches(r, 'terminal')).map((r) => r.terminal)), '航站楼');
    populateSelect('security', uniqueSorted(records.filter((r) => rowMatches(r, 'security')).map((r) => r.security)), '安检类型');
    populateSelect('departure', uniqueSorted(records.filter((r) => rowMatches(r, 'departure')).flatMap((r) => r.departureList?.length ? r.departureList : splitList(r.departure))), '出发类型');
  }

  function calculateStats(rows) {
    const uniq = (key) => new Set(rows.map((r) => r[key]).filter(Boolean)).size;
    return {
      total: rows.length,
      domestic: rows.filter((r) => r.scope === '境内').length,
      overseas: rows.filter((r) => r.scope === '境外').length,
      airports: uniq('airport'),
    };
  }

  function renderStats() {
    const stats = calculateStats(records);
    $('stat-total').textContent = number.format(stats.total);
    $('stat-domestic').textContent = number.format(stats.domestic);
    $('stat-overseas').textContent = number.format(stats.overseas);
    $('stat-airports').textContent = number.format(stats.airports);
  }

  function addBadge(parent, text, cls = '') {
    if (!text) return;
    const span = document.createElement('span');
    span.className = `badge ${cls}`.trim();
    span.textContent = text;
    parent.appendChild(span);
  }

  function addChip(parent, text, cls = '') {
    if (!text) return;
    const span = document.createElement('span');
    span.className = `chip ${cls}`.trim();
    span.textContent = text;
    parent.appendChild(span);
  }

  function addDetail(dl, label, value) {
    if (!value) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }

  function routeFor(row) {
    const parts = row.scope === '境内'
      ? [row.province, row.city, row.airport]
      : [row.continent, row.country, row.city, row.airport];
    return parts.filter(Boolean).join(' · ');
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    return Promise.resolve();
  }

  function renderCards() {
    const container = $('results');
    container.innerHTML = '';
    const shown = filteredRecords.slice(0, state.visible);
    $('result-count').textContent = number.format(filteredRecords.length);
    $('load-more').hidden = state.visible >= filteredRecords.length;

    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '没有找到匹配的贵宾厅。请调整关键词或减少筛选条件。';
      container.appendChild(empty);
      return;
    }

    const template = $('card-template');
    for (const row of shown) {
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector('h3').textContent = row.lounge || row.airport;
      node.querySelector('.route').textContent = routeFor(row);
      node.querySelector('.iata').textContent = row.iata || (row.scope === '境内' ? row.province || '境内' : '---');

      const badges = node.querySelector('.badges');
      addBadge(badges, row.scope, row.scope === '境外' ? 'overseas' : 'domestic');
      addBadge(badges, row.scope === '境内' ? row.province : row.country);
      if (row.city) addBadge(badges, row.city);

      const chips = node.querySelector('.chips');
      addChip(chips, row.terminal || '航站楼未注明', 'green');
      addChip(chips, row.departure, 'blue');
      addChip(chips, row.security);
      addChip(chips, row.serviceTime);

      node.querySelector('.directions').textContent = row.directions ? `位置：${row.directions}` : '位置：以权益二维码页面及机场现场为准。';
      const dl = node.querySelector('.details-list');
      addDetail(dl, '机场', row.airport);
      addDetail(dl, '三字码', row.iata);
      addDetail(dl, '使用方式', row.usage);
      addDetail(dl, '服务内容', row.serviceContent);
      addDetail(dl, '携伴规则', row.guestPolicy);
      addDetail(dl, '备注', row.note);
      addDetail(dl, '来源', row.source);
      if (!dl.children.length) node.querySelector('details').hidden = true;

      node.querySelector('.copy-btn').addEventListener('click', async () => {
        const text = [row.scope, routeFor(row), row.terminal, row.lounge, row.directions].filter(Boolean).join(' / ');
        await copyText(text);
        showToast('已复制位置');
      });
      container.appendChild(node);
    }
  }

  function render() {
    updateFilterOptions();
    filteredRecords = sortRows(records.filter((r) => rowMatches(r)));
    renderStats();
    renderCards();
  }

  function showToast(message, isError = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(isError));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setStatus(text, detail = '') {
    $('data-status').textContent = text;
    $('data-generated').textContent = detail;
  }

  async function loadDefaultBundle() {
    const response = await fetch(`${DEFAULT_DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`内置数据加载失败：HTTP ${response.status}`);
    return normalizeBundle(await response.json(), '内置数据');
  }

  function setBundle(bundle, label = '内置数据') {
    activeBundle = bundle;
    records = bundle.records.map((r, i) => normalizeRecord(r, r.scope === '境内' ? 'D' : 'O', i + 1));
    state.visible = PAGE_SIZE;
    const generated = bundle.metadata?.generatedAt ? `生成时间：${bundle.metadata.generatedAt}` : '';
    setStatus(`${label} · ${number.format(records.length)} 条记录`, generated);
    render();
  }

  function mergeScope(baseRecords, incomingRecords) {
    const scopes = [...new Set(incomingRecords.map((r) => r.scope).filter(Boolean))];
    if (scopes.length >= 2) return incomingRecords;
    if (scopes.length === 1) {
      return [...baseRecords.filter((r) => r.scope !== scopes[0]), ...incomingRecords];
    }
    return incomingRecords.length ? incomingRecords : baseRecords;
  }

  function isLocalPreview() {
    return ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(location.hostname) || location.protocol === 'file:';
  }

  function shouldProxy(url) {
    if (isLocalPreview()) return false;
    // GitHub Pages has no serverless proxy endpoint; use direct fetch there.
    // Direct official AgBank Excel refresh may still be blocked by CORS, so the
    // recommended GitHub Pages update path is the included GitHub Actions job.
    if (location.hostname.endsWith('.github.io')) return false;
    try {
      const host = new URL(url).hostname;
      return /(^|\.)abchina\.com(\.cn)?$/.test(host) || host === 'agbank-visa-lounge-finder.pages.dev';
    } catch {
      return false;
    }
  }

  function proxiedUrl(url) {
    return shouldProxy(url) ? `/proxy?url=${encodeURIComponent(url)}&fresh=1` : url;
  }

  async function loadScriptOnce(src) {
    if (window.XLSX) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`脚本加载失败：${src}`));
      document.head.appendChild(script);
    });
  }

  function parseOverseasWorkbook(arrayBuffer, sourceUrl) {
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames.find((name) => /境外|贵宾/.test(name)) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const records = rows.map((row, i) => normalizeRecord({
      scope: '境外',
      continent: row['州'],
      country: row['国家'],
      city: row['城市'],
      airport: row['站点'],
      iata: row['三字码'],
      terminal: row['航站楼'],
      lounge: row['名称'],
      departure: row['出发类型'],
      security: row['安检类型'],
      directions: row['位置指引'],
      usage: '无需预约，按农行/龙腾出行权益二维码及现场规则核验使用。',
      serviceContent: '以龙腾出行权益二维码页面及现场实际展示为准。',
      guestPolicy: '权益细则通常为持卡人本人使用；携伴规则请以对应活动/券码页面为准。',
      note: '境外及中国港澳台地区指定机场贵宾室，具体以农行/龙腾出行实时展示为准。',
      source: sourceUrl,
    }, 'O', i + 1));
    return normalizeBundle({ metadata: { generatedAt: new Date().toISOString(), runtimeSource: sourceUrl }, records }, sourceUrl);
  }

  function decodeHtml(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function parseStructuredHtml(text, sourceUrl) {
    const match = text.match(/<script\s+id=["']lounge-data["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
    if (!match) throw new Error('网页中未找到 script#lounge-data 结构化数据');
    const data = JSON.parse(decodeHtml(match[1]));
    return normalizeBundle({ metadata: { generatedAt: new Date().toISOString(), runtimeSource: sourceUrl }, records: data }, sourceUrl);
  }

  async function parseRemoteSource(url) {
    const target = proxiedUrl(url);
    const lowerPath = new URL(url, location.href).pathname.toLowerCase();
    if (/\.xlsx?$/.test(lowerPath)) {
      setStatus('正在加载 Excel…', url);
      await loadScriptOnce(XLSX_CDN);
      const response = await fetch(target, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Excel 加载失败：HTTP ${response.status}`);
      return parseOverseasWorkbook(await response.arrayBuffer(), url);
    }

    setStatus('正在加载 URL 数据…', url);
    const response = await fetch(target, { cache: 'no-store' });
    if (!response.ok) throw new Error(`URL 加载失败：HTTP ${response.status}`);
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return normalizeBundle(JSON.parse(trimmed), url);
    }
    return parseStructuredHtml(text, url);
  }

  async function applyRuntimeSource(url, label = 'URL 数据', updateHistory = true) {
    if (!url) throw new Error('请先填写数据 URL');
    const incoming = await parseRemoteSource(url);
    const base = activeBundle?.records?.length ? activeBundle.records : defaultBundle.records;
    const merged = mergeScope(base, incoming.records);
    const bundle = {
      metadata: { ...incoming.metadata, generatedAt: new Date().toISOString(), runtimeSource: url },
      records: merged,
    };
    setBundle(bundle, label);
    localStorage.setItem('agbank-lounge-source-url', url);
    const sourceInput = $('source-url');
    if (sourceInput) sourceInput.value = url;
    if (updateHistory) {
      const next = new URL(location.href);
      next.searchParams.set('dataUrl', url);
      history.replaceState(null, '', next);
    }
    showToast('数据已更新');
  }

  function clearFilters() {
    state.q = '';
    $('q').value = '';
    for (const key of filterKeys) state[key] = '';
    state.sort = 'default';
    $('sort').value = 'default';
    state.visible = PAGE_SIZE;
    render();
  }

  function exportCsv() {
    const columns = [
      ['scope', '范围'], ['continent', '洲'], ['country', '国家'], ['province', '省份'], ['city', '城市'],
      ['airport', '机场/站点'], ['iata', '三字码'], ['terminal', '航站楼'], ['lounge', '贵宾厅'],
      ['departure', '出发类型'], ['security', '安检类型'], ['directions', '位置指引'], ['serviceTime', '服务时间'],
      ['usage', '使用方式'], ['serviceContent', '服务内容'], ['guestPolicy', '携伴规则'], ['note', '备注'],
    ];
    const escape = (value) => `"${clean(value).replace(/"/g, '""')}"`;
    const csv = [
      columns.map(([, label]) => escape(label)).join(','),
      ...filteredRecords.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
    ].join('\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `农行机场贵宾厅查询结果_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bindEvents() {
    const on = (id, eventName, handler) => {
      const el = $(id);
      if (el) el.addEventListener(eventName, handler);
    };

    $('q').addEventListener('input', (event) => {
      state.q = event.target.value.trim();
      state.visible = PAGE_SIZE;
      render();
    });
    for (const key of filterKeys) {
      filterEls[key].addEventListener('change', (event) => {
        state[key] = event.target.value;
        state.visible = PAGE_SIZE;
        render();
      });
    }
    $('sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      render();
    });
    $('clear-filters').addEventListener('click', clearFilters);
    $('export-csv').addEventListener('click', exportCsv);
    $('load-more').addEventListener('click', () => {
      state.visible += PAGE_SIZE;
      renderCards();
    });
    on('copy-current-url', 'click', async () => {
      await copyText(location.href);
      showToast('已复制当前链接');
    });
  }

  async function init() {
    bindEvents();
    localStorage.removeItem('agbank-lounge-source-url');
    try {
      defaultBundle = await loadDefaultBundle();
      setBundle(defaultBundle, '内置数据');
    } catch (error) {
      setStatus('内置数据加载失败', error.message);
      showToast(error.message, true);
    }
  }

  init();
})();
