/*
 * Splitwise Web Clone — core domain logic (pure, no DOM).
 * Works in the browser (window.SplitCore) and in Node (module.exports) for tests.
 *
 * Money is ALWAYS integer cents. Never floats.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SplitCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Money helpers
   * ------------------------------------------------------------------ */

  // Parse a user-typed amount ("1,234.5", "¥12", "12.345") into integer cents.
  function toCents(input) {
    if (typeof input === 'number') return Math.round(input * 100);
    if (input == null) return 0;
    const s = String(input).replace(/[^0-9.\-]/g, '');
    if (!s || s === '.' || s === '-') return 0;
    const neg = s.startsWith('-');
    const [i, f = ''] = s.replace('-', '').split('.');
    // round half-up to cents: 12.345 -> 1235
    const frac = Math.round(parseFloat('0.' + (f || '0')) * 100);
    let cents = parseInt(i || '0', 10) * 100 + frac;
    return neg ? -cents : cents;
  }

  function fromCents(cents) {
    return (cents / 100).toFixed(2);
  }

  // Split an integer into n nearly-equal integer parts; the first `rem`
  // parts get one extra unit (this is how Splitwise handles equal splits).
  function distributeEqual(total, n) {
    if (n <= 0) return [];
    const base = Math.floor(total / n);
    const rem = total - base * n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
    return out;
  }

  // Distribute `total` by weights (shares or percentages), keeping the sum exact.
  function distributeByWeights(total, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) return distributeEqual(total, weights.length);
    const exact = weights.map(w => (total * w) / sum);
    const floors = exact.map(v => Math.floor(v));
    let rem = total - floors.reduce((a, b) => a + b, 0);
    // hand the remainder out one unit at a time, largest fractional part first
    const order = exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    const out = floors.slice();
    for (let k = 0; k < order.length && rem > 0; k++, rem--) out[order[k].i] += 1;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Currencies (static reference rates, units per 1 USD)
   * ------------------------------------------------------------------ */

  const CURRENCIES = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1, locales: 'en-US' },
    CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate: 7.12, locales: 'zh-CN' },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92, locales: 'de-DE' },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.78, locales: 'en-GB' },
    JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 147.2, locales: 'ja-JP' },
    HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', rate: 7.8, locales: 'zh-HK' },
    KRW: { code: 'KRW', symbol: '₩', name: 'Korean Won', rate: 1330, locales: 'ko-KR' },
    SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate: 1.34, locales: 'en-SG' },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.52, locales: 'en-AU' },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.36, locales: 'en-CA' },
    TWD: { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', rate: 32.1, locales: 'zh-TW' },
    INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.4, locales: 'en-IN' },
    THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', rate: 36.2, locales: 'th-TH' },
    MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', rate: 4.72, locales: 'ms-MY' },
  };

  function currency(code) {
    return CURRENCIES[code] || CURRENCIES.USD;
  }

  function convertCents(cents, from, to) {
    if (from === to) return cents;
    const rf = currency(from).rate; // units of `from` per USD
    const rt = currency(to).rate;   // units of `to` per USD
    if (!rf || !rt) return cents;
    return Math.round((cents * rt) / rf);
  }

  // "$12.34" / "¥1,234.00" / "-$5.00"
  function formatMoney(cents, code, opts) {
    const o = opts || {};
    const c = currency(code);
    const neg = cents < 0;
    const abs = Math.abs(cents);
    const body = (abs / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = neg ? '-' : o.forcePlus ? '+' : '';
    return sign + c.symbol + body;
  }

  // For inputs: strip grouping, keep 2 decimals.
  function formatMoneyInput(cents, code) {
    const c = currency(code);
    return c.symbol + (Math.abs(cents) / 100).toFixed(2);
  }

  /* ------------------------------------------------------------------ *
   * Categories (Splitwise-style: colored inline icons)
   * ------------------------------------------------------------------ */

  // color: icon chip background, ink: glyph color
  const CATEGORIES = [
    { id: 'general',      name: 'General',           color: '#6D767E', ink: '#FFFFFF', glyph: 'receipt' },
    { id: 'dining',       name: 'Dining out',        color: '#F96817', ink: '#FFFFFF', glyph: 'utensils' },
    { id: 'groceries',    name: 'Groceries',         color: '#18A582', ink: '#FFFFFF', glyph: 'basket' },
    { id: 'liquor',       name: 'Drinks',            color: '#AD74ED', ink: '#FFFFFF', glyph: 'glass' },
    { id: 'rent',         name: 'Rent',              color: '#421076', ink: '#FFFFFF', glyph: 'home' },
    { id: 'utilities',    name: 'Utilities',         color: '#1CC29F', ink: '#FFFFFF', glyph: 'bolt' },
    { id: 'household',    name: 'Household supplies',color: '#1D856C', ink: '#FFFFFF', glyph: 'box' },
    { id: 'transport',    name: 'Transportation',    color: '#16715E', ink: '#FFFFFF', glyph: 'car' },
    { id: 'fuel',         name: 'Gas/fuel',          color: '#D34508', ink: '#FFFFFF', glyph: 'fuel' },
    { id: 'entertainment',name: 'Entertainment',     color: '#9153D2', ink: '#FFFFFF', glyph: 'film' },
    { id: 'travel',       name: 'Travel',            color: '#52595F', ink: '#FFFFFF', glyph: 'plane' },
    { id: 'hotel',        name: 'Hotel',             color: '#0A5243', ink: '#FFFFFF', glyph: 'bed' },
    { id: 'clothing',     name: 'Clothing',          color: '#EE87A0', ink: '#421076', glyph: 'shirt' },
    { id: 'electronics',  name: 'Electronics',       color: '#373B3F', ink: '#FFFFFF', glyph: 'laptop' },
    { id: 'games',        name: 'Games',             color: '#7B44B5', ink: '#FFFFFF', glyph: 'gamepad' },
    { id: 'sports',       name: 'Sports',            color: '#1CC29F', ink: '#FFFFFF', glyph: 'ball' },
    { id: 'health',       name: 'Health',            color: '#B4002B', ink: '#FFFFFF', glyph: 'heart' },
    { id: 'education',    name: 'Education',         color: '#BDC9D4', ink: '#373B3F', glyph: 'book' },
    { id: 'gifts',        name: 'Gifts',             color: '#F2C9D4', ink: '#920829', glyph: 'gift' },
    { id: 'donations',    name: 'Donations',         color: '#ACE4D6', ink: '#0A5243', glyph: 'hands' },
    { id: 'other',        name: 'Other',             color: '#95A0AA', ink: '#FFFFFF', glyph: 'dots' },
  ];

  function category(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  }

  /* ------------------------------------------------------------------ *
   * Splitting
   * ------------------------------------------------------------------ */

  const SPLIT_METHODS = [
    { id: 'equal',       name: 'Split equally',  short: 'Equally' },
    { id: 'exact',       name: 'Exact amounts',  short: 'Exact' },
    { id: 'percent',     name: 'Percentages',    short: 'Percent' },
    { id: 'shares',      name: 'Shares',         short: 'Shares' },
    { id: 'adjustment',  name: 'Adjustment',     short: 'Adjust' },
  ];

  /*
   * computeSplit — the heart of the app.
   *   total      : integer cents
   *   participants: [{ userId, value }]  (value meaning depends on method)
   *   method     : 'equal' | 'exact' | 'percent' | 'shares' | 'adjustment'
   * Returns { ok, method, splits:[{userId, cents}], unallocated, error }
   */
  function computeSplit(method, total, participants) {
    const list = participants.filter(p => p.userId);
    if (!list.length) return { ok: false, error: 'Select at least one participant', splits: [] };

    if (method === 'equal') {
      const parts = distributeEqual(total, list.length);
      return {
        ok: true,
        method,
        splits: list.map((p, i) => ({ userId: p.userId, cents: parts[i] })),
        unallocated: 0,
      };
    }

    if (method === 'exact') {
      const splits = list.map(p => ({ userId: p.userId, cents: Math.round(toCents(p.value)) }));
      const sum = splits.reduce((a, s) => a + s.cents, 0);
      const unallocated = total - sum;
      return {
        ok: unallocated === 0,
        method,
        splits,
        unallocated,
        error: unallocated === 0 ? null
          : unallocated > 0 ? formatMoney(unallocated, 'USD') + ' unallocated'
                            : formatMoney(-unallocated, 'USD') + ' over-allocated',
      };
    }

    if (method === 'percent') {
      const weights = list.map(p => Math.max(0, parseFloat(p.value) || 0));
      const pctSum = weights.reduce((a, b) => a + b, 0);
      const parts = distributeByWeights(total, weights);
      const splits = list.map((p, i) => ({ userId: p.userId, cents: parts[i] }));
      const unallocated = total - splits.reduce((a, s) => a + s.cents, 0);
      return {
        ok: Math.abs(pctSum - 100) < 1e-6 && unallocated === 0,
        method,
        splits,
        unallocated,
        pctRemaining: Math.round((100 - pctSum) * 100) / 100,
        error: Math.abs(pctSum - 100) < 1e-6 ? null : 'Percentages must add up to 100%',
      };
    }

    if (method === 'shares') {
      const weights = list.map(p => Math.max(0, parseFloat(p.value) || 0));
      if (weights.every(w => w === 0)) {
        return { ok: false, method, splits: [], error: 'Enter at least one share', unallocated: total };
      }
      const parts = distributeByWeights(total, weights);
      const splits = list.map((p, i) => ({ userId: p.userId, cents: parts[i] }));
      const unallocated = total - splits.reduce((a, s) => a + s.cents, 0);
      return { ok: unallocated === 0, method, splits, unallocated };
    }

    if (method === 'adjustment') {
      // start from an equal split, apply signed deltas; must sum back to total
      const base = distributeEqual(total, list.length);
      const deltas = list.map(p => Math.round(toCents(p.value)));
      const splits = list.map((p, i) => ({ userId: p.userId, cents: base[i] + deltas[i] }));
      const unallocated = total - splits.reduce((a, s) => a + s.cents, 0);
      return {
        ok: unallocated === 0,
        method,
        splits,
        unallocated,
        base: list.map((p, i) => ({ userId: p.userId, cents: base[i] })),
        error: unallocated === 0 ? null
          : unallocated > 0 ? formatMoney(unallocated, 'USD') + ' unallocated'
                            : formatMoney(-unallocated, 'USD') + ' over-allocated',
      };
    }

    return { ok: false, error: 'Unknown split method', splits: [] };
  }

  /* ------------------------------------------------------------------ *
   * Balances
   * ------------------------------------------------------------------ */

  function activeExpenses(state, groupId) {
    return state.expenses.filter(e => !e.deleted && (groupId === undefined || e.groupId === groupId));
  }

  function activePayments(state, groupId) {
    return state.payments.filter(p => !p.deleted && (groupId === undefined || p.groupId === groupId));
  }

  /*
   * Net balance per user inside one group, in the group currency.
   * Positive => the group (others) owes this user.
   */
  function groupBalances(state, groupId) {
    const group = state.groups.find(g => g.id === groupId);
    const bal = {};
    if (group) for (const m of group.members) bal[m] = 0;
    for (const e of activeExpenses(state, groupId)) {
      if (bal[e.paidBy] === undefined) bal[e.paidBy] = 0;
      bal[e.paidBy] += e.amountCents;
      for (const s of e.splits) {
        if (bal[s.userId] === undefined) bal[s.userId] = 0;
        bal[s.userId] -= s.cents;
      }
    }
    for (const p of activePayments(state, groupId)) {
      if (bal[p.from] === undefined) bal[p.from] = 0;
      if (bal[p.to] === undefined) bal[p.to] = 0;
      bal[p.from] += p.amountCents;
      bal[p.to] -= p.amountCents;
    }
    return bal;
  }

  // Net balance between two users inside one group (a-b, in group currency).
  function pairwiseBalance(state, groupId, a, b) {
    const bal = groupBalances(state, groupId);
    return (bal[a] || 0) - (bal[b] || 0);
  }

  /*
   * Simplify debts: minimum number of transfers that settles every balance.
   * Greedy max-creditor / max-debtor matching (standard, always terminates).
   * Returns [{ from, to, cents }] sorted by amount desc.
   */
  function simplifyDebts(balances) {
    const creditors = [];
    const debtors = [];
    for (const [uid, v] of Object.entries(balances)) {
      if (v > 0) creditors.push({ uid, v });
      else if (v < 0) debtors.push({ uid, v: -v });
    }
    creditors.sort((a, b) => b.v - a.v);
    debtors.sort((a, b) => b.v - a.v);
    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amt = Math.min(debtors[i].v, creditors[j].v);
      if (amt > 0) transfers.push({ from: debtors[i].uid, to: creditors[j].uid, cents: amt });
      debtors[i].v -= amt;
      creditors[j].v -= amt;
      if (debtors[i].v === 0) i++;
      if (creditors[j].v === 0) j++;
    }
    return transfers.sort((a, b) => b.cents - a.cents);
  }

  /* ------------------------------------------------------------------ *
   * Overall (account-level) balances, converted to the default currency
   * ------------------------------------------------------------------ */

  // Per-group net for `me`, converted to default currency.
  // Positive => I am owed there, negative => I owe.
  function myGroupNet(state, meId, groupId, defaultCurrency) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return 0;
    const bal = groupBalances(state, groupId);
    const mine = bal[meId] || 0;
    return convertCents(mine, group.currency, defaultCurrency);
  }

  function overallBalance(state, meId, defaultCurrency) {
    let total = 0;
    for (const g of state.groups) {
      if (!g.members.includes(meId)) continue;
      total += myGroupNet(state, meId, g.id, defaultCurrency);
    }
    return total;
  }

  // "You are owed" (sum of positive nets) and "you owe" (sum of |negative nets|),
  // matching how Splitwise splits the dashboard summary.
  function overallSummary(state, meId, defaultCurrency) {
    let owed = 0, owe = 0;
    for (const g of state.groups) {
      if (!g.members.includes(meId)) continue;
      const net = myGroupNet(state, meId, g.id, defaultCurrency);
      if (net > 0) owed += net;
      else if (net < 0) owe += -net;
    }
    return { owed, owe, net: owed - owe };
  }

  // Per-friend balance for `me` across all shared groups, in default currency.
  function friendBalances(state, meId, defaultCurrency) {
    const out = {}; // friendId -> cents (+ owed to me / - I owe)
    for (const g of state.groups) {
      if (!g.members.includes(meId)) continue;
      const bal = groupBalances(state, g.id);
      for (const m of g.members) {
        if (m === meId) continue;
        const net = (bal[meId] || 0) - (bal[m] || 0);
        const conv = convertCents(net, g.currency, defaultCurrency);
        out[m] = (out[m] || 0) + conv;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * CSV export (Splitwise-style columns)
   * ------------------------------------------------------------------ */

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function expensesToCsv(state, meId) {
    const header = ['Date', 'Description', 'Category', 'Group', 'Cost', 'Currency',
                    'Paid by', 'Split method', 'Your share', 'Your net'];
    const rows = [header.join(',')];
    const myGroupIds = new Set(state.groups
      .filter(g => g.members.includes(meId))
      .map(g => g.id));
    const exps = activeExpenses(state)
      .filter(e => myGroupIds.has(e.groupId))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const e of exps) {
      const group = state.groups.find(g => g.id === e.groupId);
      const payer = state.users[e.paidBy];
      const share = e.splits.find(s => s.userId === meId);
      const myShare = share ? share.cents : 0;
      const net = e.paidBy === meId ? e.amountCents - myShare : -myShare;
      rows.push([
        e.date,
        e.description,
        category(e.categoryId).name,
        group ? group.name : '',
        (e.amountCents / 100).toFixed(2),
        e.currency,
        payer ? payer.name : '',
        e.splitMethod,
        (myShare / 100).toFixed(2),
        (net / 100).toFixed(2),
      ].map(csvEscape).join(','));
    }
    return rows.join('\n');
  }

  /* ------------------------------------------------------------------ *
   * Misc helpers
   * ------------------------------------------------------------------ */

  function id(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const AVATAR_COLORS = ['#1CC29F', '#9153D2', '#F96817', '#EE87A0', '#1D856C', '#7B44B5',
                         '#D34508', '#18A582', '#AD74ED', '#BDC9D4', '#0A5243', '#421076'];

  function avatarColor(seed) {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  // "Oct 12" / "Oct 12, 2025" / "Today" / "Yesterday"
  function formatDate(iso, opts) {
    const o = opts || {};
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const dayMs = 86400000;
    const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
    if (o.relative && diffDays === 0) return 'Today';
    if (o.relative && diffDays === 1) return 'Yesterday';
    const sameYear = d.getFullYear() === now.getFullYear();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    if (sameYear) return month + ' ' + day;
    return month + ' ' + day + ', ' + d.getFullYear();
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function todayISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  return {
    toCents, fromCents, distributeEqual, distributeByWeights,
    CURRENCIES, currency, convertCents, formatMoney, formatMoneyInput,
    CATEGORIES, category, SPLIT_METHODS, computeSplit,
    activeExpenses, activePayments, groupBalances, pairwiseBalance, simplifyDebts,
    myGroupNet, overallBalance, overallSummary, friendBalances,
    expensesToCsv, id, initials, avatarColor, formatDate, formatTime, todayISO,
  };
});
