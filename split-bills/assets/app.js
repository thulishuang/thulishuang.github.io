/*
 * Splitwise Web Clone — UI application (part 1/3: state, seed, icons,
 * helpers, router, app shell, screens).
 * Replicates the Splitwise mobile app (bottom tabs + FAB + full-screen forms)
 * and the desktop web app (left sidebar) on screens >=960px.
 * All data lives in localStorage; nothing leaves the browser.
 */
(function () {
  'use strict';

  const C = window.SplitCore;
  const STORE_KEY = 'splitwise-clone-v1';

  /* ================================================================== *
   * State & persistence
   * ================================================================== */

  let state = null;
  const ui = {
    sheets: [],          // sheet stack: [{title, wide, bodyHtml, footHtml, headRight, onClose}]
    draft: null,         // expense draft
    settleDraft: null,
    groupDraft: null,
    profileDraft: null,
    recurringDraft: null,
    memberDraft: null,
    activityFilter: 'all',
    allExpFilter: { q: '', groupId: 'all' },
  };

  function blankState() {
    return {
      version: 1,
      session: null,       // {email} when logged in
      meId: 'u_me',
      users: {},
      groups: [],
      expenses: [],
      payments: [],
      comments: [],
      recurring: [],
      settings: { theme: 'system', defaultCurrency: 'USD', notifications: { email: true, push: false, comments: true } },
      sync: { mode: 'local', url: '', room: '', headerName: '', headerValue: '', lastSyncAt: null, status: 'idle', lastError: '', log: [],
              // deployment default for this GitHub Pages site (thulishuang's own repo);
              // change these if you host the ledger somewhere else
              ghRepo: 'thulishuang/thulishuang.github.io',
              ghPath: 'split-bills-data/ledger.jsonl',
              ghBranch: 'main', ghToken: '', ghPrivate: null, ghVisibilityAt: 0, ghPass: '' },
      updatedAt: new Date(0).toISOString(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) { state = parsed; return; }
      }
    } catch (e) { /* corrupted store -> start fresh */ }
    state = blankState();
    save();
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
    }, 60);
  }

  function commit() {
    save();
    state.updatedAt = new Date().toISOString();
    render();
    renderSheetRoot();
    scheduleAutoSync();
  }

  /* ================================================================== *
   * Demo seed data — a trip, an apartment and friends, mixed currencies
   * ================================================================== */

  function seedDemo() {
    const s = blankState();
    s.users = {
      u_me:   { id: 'u_me',   name: 'Alex Morgan', email: 'alex@example.com', color: '#1CC29F' },
      u_emma: { id: 'u_emma', name: 'Emma Wilson', email: 'emma@example.com', color: '#9153D2' },
      u_jack: { id: 'u_jack', name: 'Jack Chen',   email: 'jack@example.com', color: '#F96817' },
      u_lily: { id: 'u_lily', name: 'Lily Zhang',  email: 'lily@example.com', color: '#EE87A0' },
      u_noah: { id: 'u_noah', name: 'Noah Kim',    email: 'noah@example.com', color: '#1D856C' },
      u_sam:  { id: 'u_sam',  name: 'Sam Rivera',  email: 'sam@example.com',  color: '#7B44B5' },
    };
    s.groups = [
      { id: 'g_trip', kind: 'group', name: 'Japan Trip 2026', emoji: '\u{1F5FE}', currency: 'JPY',
        members: ['u_me', 'u_emma', 'u_jack', 'u_lily'], simplifyDebts: true,
        createdAt: '2026-08-20T09:12:00', createdBy: 'u_me' },
      { id: 'g_apt', kind: 'group', name: 'Apartment 404', emoji: '\u{1F3E0}', currency: 'CNY',
        members: ['u_me', 'u_emma', 'u_noah'], simplifyDebts: false,
        createdAt: '2026-06-02T20:40:00', createdBy: 'u_me' },
      { id: 'g_hike', kind: 'group', name: 'Weekend Hiking', emoji: '\u{1F97E}', currency: 'USD',
        members: ['u_me', 'u_jack', 'u_lily', 'u_noah'], simplifyDebts: false,
        createdAt: '2026-09-12T11:05:00', createdBy: 'u_jack' },
      { id: 'f_sam', kind: 'friend', name: 'Sam Rivera', emoji: '', currency: 'USD',
        members: ['u_me', 'u_sam'], simplifyDebts: false,
        createdAt: '2026-09-30T18:22:00', createdBy: 'u_me' },
    ];

    const D = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const TS = n => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 30, 0, 0); return d.toISOString(); };

    s.expenses = [
      { id: 'e1', groupId: 'g_trip', description: 'Ramen dinner in Shinjuku', amountCents: 820000, currency: 'JPY',
        categoryId: 'dining', paidBy: 'u_emma', date: D(21), createdAt: TS(21),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 205000 }, { userId: 'u_emma', cents: 205000 },
        { userId: 'u_jack', cents: 205000 }, { userId: 'u_lily', cents: 205000 }], notes: '' },
      { id: 'e2', groupId: 'g_trip', description: 'Shinkansen tickets Tokyo \u2192 Kyoto', amountCents: 284000, currency: 'JPY',
        categoryId: 'travel', paidBy: 'u_me', date: D(20), createdAt: TS(20),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 71000 }, { userId: 'u_emma', cents: 71000 },
        { userId: 'u_jack', cents: 71000 }, { userId: 'u_lily', cents: 71000 }], notes: 'Reserved cars 4-5, all forward-facing' },
      { id: 'e3', groupId: 'g_trip', description: 'Hotel capsule 2 nights', amountCents: 460000, currency: 'JPY',
        categoryId: 'hotel', paidBy: 'u_jack', date: D(20), createdAt: TS(20),
        splitMethod: 'exact', splits: [{ userId: 'u_me', cents: 160000 }, { userId: 'u_emma', cents: 120000 },
        { userId: 'u_jack', cents: 90000 }, { userId: 'u_lily', cents: 90000 }], notes: 'Lily & Jack shared one capsule' },
      { id: 'e4', groupId: 'g_apt', description: 'August rent', amountCents: 980000, currency: 'CNY',
        categoryId: 'rent', paidBy: 'u_me', date: D(34), createdAt: TS(34),
        splitMethod: 'shares', splits: [{ userId: 'u_me', cents: 490000 }, { userId: 'u_emma', cents: 343000 },
        { userId: 'u_noah', cents: 147000 }], notes: 'Master bedroom counts double' },
      { id: 'e5', groupId: 'g_apt', description: 'Water & electricity', amountCents: 42350, currency: 'CNY',
        categoryId: 'utilities', paidBy: 'u_noah', date: D(12), createdAt: TS(12),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 14117 }, { userId: 'u_emma', cents: 14117 },
        { userId: 'u_noah', cents: 14116 }], notes: '' },
      { id: 'e6', groupId: 'g_apt', description: 'Groceries run', amountCents: 31280, currency: 'CNY',
        categoryId: 'groceries', paidBy: 'u_emma', date: D(5), createdAt: TS(5),
        splitMethod: 'percent', splits: [{ userId: 'u_me', cents: 12512 }, { userId: 'u_emma', cents: 12512 },
        { userId: 'u_noah', cents: 6256 }], notes: 'Noah was away half the week' },
      { id: 'e7', groupId: 'g_hike', description: 'Cabin for the night', amountCents: 24000, currency: 'USD',
        categoryId: 'hotel', paidBy: 'u_jack', date: D(9), createdAt: TS(9),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 6000 }, { userId: 'u_jack', cents: 6000 },
        { userId: 'u_lily', cents: 6000 }, { userId: 'u_noah', cents: 6000 }], notes: '' },
      { id: 'e8', groupId: 'g_hike', description: 'Gas & tolls', amountCents: 8650, currency: 'USD',
        categoryId: 'fuel', paidBy: 'u_me', date: D(9), createdAt: TS(9),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 2163 }, { userId: 'u_jack', cents: 2163 },
        { userId: 'u_lily', cents: 2162 }, { userId: 'u_noah', cents: 2162 }], notes: '' },
      { id: 'e9', groupId: 'g_hike', description: 'Trailhead BBQ', amountCents: 15840, currency: 'USD',
        categoryId: 'dining', paidBy: 'u_lily', date: D(8), createdAt: TS(8),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 3960 }, { userId: 'u_jack', cents: 3960 },
        { userId: 'u_lily', cents: 3960 }, { userId: 'u_noah', cents: 3960 }], notes: '' },
      { id: 'e10', groupId: 'f_sam', description: 'Concert tickets', amountCents: 12000, currency: 'USD',
        categoryId: 'entertainment', paidBy: 'u_sam', date: D(3), createdAt: TS(3),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 6000 }, { userId: 'u_sam', cents: 6000 }], notes: '' },
      { id: 'e11', groupId: 'g_trip', description: 'Convenience store snacks', amountCents: 248000, currency: 'JPY',
        categoryId: 'groceries', paidBy: 'u_lily', date: D(6), createdAt: TS(6),
        splitMethod: 'adjustment', splits: [{ userId: 'u_me', cents: 68500 }, { userId: 'u_emma', cents: 68500 },
        { userId: 'u_jack', cents: 62000 }, { userId: 'u_lily', cents: 49000 }], notes: 'Jack skipped the second 7-Eleven run' },
      { id: 'e12', groupId: 'g_apt', description: 'Cleaning supplies', amountCents: 18900, currency: 'CNY',
        categoryId: 'household', paidBy: 'u_me', date: D(2), createdAt: TS(2),
        splitMethod: 'equal', splits: [{ userId: 'u_me', cents: 6300 }, { userId: 'u_emma', cents: 6300 },
        { userId: 'u_noah', cents: 6300 }], notes: '' },
    ];
    s.payments = [
      { id: 'p1', groupId: 'g_apt', from: 'u_emma', to: 'u_me', amountCents: 150000, currency: 'CNY',
        date: D(28), method: 'Bank transfer', note: 'July rent share', createdAt: TS(28) },
      { id: 'p2', groupId: 'g_hike', from: 'u_noah', to: 'u_me', amountCents: 3000, currency: 'USD',
        date: D(7), method: 'Cash', note: '', createdAt: TS(7) },
    ];
    s.comments = [
      { id: 'c1', expenseId: 'e3', userId: 'u_lily', text: 'The capsule was tiny but so clean!', createdAt: TS(19) },
      { id: 'c2', expenseId: 'e3', userId: 'u_me', text: 'Booking the same place again next year?', createdAt: TS(18) },
      { id: 'c3', expenseId: 'e9', userId: 'u_jack', text: 'Best yakitori of the trip, no debate.', createdAt: TS(8) },
    ];
    s.recurring = [
      { id: 'r1', groupId: 'g_apt', description: 'Monthly rent', amountCents: 980000, currency: 'CNY',
        categoryId: 'rent', paidBy: 'u_me', splitMethod: 'shares', cadence: 'monthly', nextDate: nextMonth(), createdAt: TS(34) },
    ];
    s.session = null;
    state = s;
  }

  function nextMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
  }

  /* ================================================================== *
   * Icons (inline SVG, stroke style)
   * ================================================================== */

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    activity: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    chevron: '<path d="M9 18l6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    chart: '<path d="M5 20V11M12 20V4M19 20v-6"/><path d="M3 21h18"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/>',
    receipt: '<path d="M5 2v20l2-1.5L9 22l2-1.5L13 22l2-1.5L17 22l2-1.5V2l-2 1.5L15 2l-2 1.5L11 2 9 1.5 7 2z"/><path d="M9 7h6M9 11h6"/>',
    dollar: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    crown: '<path d="m2 7 4.5 3L12 4l5.5 6L22 7l-1.6 11.4a2 2 0 0 1-2 1.6H5.6a2 2 0 0 1-2-1.6z"/>',
    repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    scale: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="m3 7 3 7h6l3-7"/><path d="m15 7 3 7h6l-3-7"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  };

  const GLYPHS = {
    receipt: '<path d="M6 2h12v18l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22z"/><path d="M9 7h6M9 11h6" fill="none"/>',
    utensils: '<path d="M7 3v6a2 2 0 0 0 2 2v10h2V11a2 2 0 0 0 2-2V3h-2v5H9V3z"/><path d="M17 3c-1.6 2.2-2 3.6-2 5.2 0 1.6.8 2.6 1.6 3.2.5.4.6.9.6 1.6V21h1.6v-8c0-.7.1-1.2.6-1.6.8-.6 1.6-1.6 1.6-3.2C21 6.6 18.6 3 17 3z"/>',
    basket: '<path d="M4 9h16l-1.5 11.2A2 2 0 0 1 16.5 22h-9a2 2 0 0 1-2-1.8z"/><path d="M9 9 12 3l3 6" fill="none"/>',
    glass: '<path d="M7 3h10l-1 7a4 4 0 0 1-3 3.8V21h-2v-7.2A4 4 0 0 1 8 10z"/>',
    home: '<path d="M12 2 2 10h3v11h6v-6h2v6h6V10h3z"/>',
    bolt: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
    box: '<path d="M12 2 3 7v10l9 5 9-5V7z" opacity=".4"/><path d="M12 2 3 7l9 5 9-5z"/><path d="M3 7v10l9 5V12" fill="none"/>',
    car: '<path d="M5 11h14l-1.6 6.2A2 2 0 0 1 15.5 19h-7a2 2 0 0 1-1.9-1.8z"/><path d="M5.5 11 7 6.5A2 2 0 0 1 8.9 5h6.2a2 2 0 0 1 1.9 1.5L18.5 11" fill="none"/><circle cx="8" cy="15.5" r="1"/><circle cx="16" cy="15.5" r="1"/>',
    fuel: '<path d="M5 3h8v18H5z"/><path d="M13 8h3l3 3v7a2 2 0 0 0 2-2v-3l-2.5-2.5" fill="none"/><path d="M7 7h4" fill="none"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2" opacity=".4"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" fill="none"/>',
    plane: '<path d="M21 15v-2l-8-4V3.5a1.5 1.5 0 0 0-3 0V9l-8 4v2l8-2.5V13l-2.5 2v2l4-1 4 1v-2L13 13v-2.5z"/>',
    bed: '<path d="M2 17v-8"/><path d="M2 12h19v5"/><path d="M6 12V9h5v3" fill="none"/>',
    shirt: '<path d="M8 3 4 6l2 3 2-1v13h8V8l2 1 2-3-4-3a4 4 0 0 1-8 0z"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1" opacity=".4"/><path d="M4 6h16v9H4z"/><path d="M2 19h20" fill="none"/>',
    gamepad: '<path d="M7 8h10a5 5 0 0 1 5 5v1a4 4 0 0 1-7 2.6L13 15h-2l-2 1.6A4 4 0 0 1 2 14v-1a5 5 0 0 1 5-5z"/><path d="M8 11v3M6.5 12.5h3M16 12h.01M18 14h.01" fill="none"/>',
    ball: '<circle cx="12" cy="12" r="9" opacity=".4"/><circle cx="12" cy="12" r="9" fill="none"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M3.5 9h17M3.5 15h17" fill="none"/>',
    heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
    book: '<path d="M12 5v15"/><path d="M3 6a3 3 0 0 1 3-3h6v15H6a3 3 0 0 0-3 3z"/><path d="M21 6a3 3 0 0 0-3-3h-6v15h6a3 3 0 0 1 3 3z"/>',
    gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9"/><path d="M12 8v13" fill="none"/><path d="M12 8S10 3 7.5 4.5C5.5 5.7 7 8 12 8zM12 8s2-5 4.5-3.5C18.5 5.7 17 8 12 8z"/>',
    hands: '<path d="M12 10s-4-2.5-5.5-5A3 3 0 0 1 12 3.5 3 3 0 0 1 17.5 5c-1.5 2.5-5.5 5-5.5 5z"/><path d="M4 12h16"/><path d="m6 12-1.5 6a2 2 0 0 0 2 2.5h11a2 2 0 0 0 2-2.5L18 12" fill="none"/>',
    dots: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
  };

  function icon(name, cls) {
    const p = ICONS[name] || '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  function glyph(name, cls) {
    const p = GLYPHS[name] || GLYPHS.dots;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + p + '</svg>';
  }

  function catChip(catId, size) {
    const c = C.category(catId);
    const cls = size === 'lg' ? 'cat-chip lg' : size === 'sm' ? 'cat-chip sm' : 'cat-chip';
    return '<div class="' + cls + '" style="background:' + c.color + ';color:' + c.ink + '">' + glyph(c.glyph) + '</div>';
  }

  function logo(size, onGreen) {
    return '<span class="logo' + (onGreen ? ' on-green' : '') + '">' +
      '<svg width="' + (size || 30) + '" height="' + (size || 30) + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect width="64" height="64" rx="14" fill="#1CC29F"/>' +
      '<path d="M12 20.2C12 15.8 15.6 12.3 20 12.3h24c4.4 0 8 3.5 8 7.9v16.2c0 4.4-3.6 7.9-8 7.9H27.6L16.9 51c-1.2 1-3 .1-3-1.5v-4.1a8.4 8.4 0 0 1-1.9-5.3z" fill="#FFFFFF" opacity="0.45"/>' +
      '<path d="M12 20.2C12 15.8 15.6 12.3 20 12.3h24c4.4 0 8 3.5 8 7.9v16.2c0 4.4-3.6 7.9-8 7.9H27.6L16.9 51c-1.2 1-3 .1-3-1.5z" fill="#FFFFFF"/>' +
      '</svg><span class="logo-word">Splitwise</span></span>';
  }

  /* ================================================================== *
   * DOM helpers
   * ================================================================== */

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function user(uid) { return state.users[uid] || { id: uid, name: 'Unknown', color: '#95A0AA' }; }

  /* ------------------------------------------------------------------ *
   * Identity — no accounts, no invites. The pair (name, email) IS the
   * account: the same inputs always derive the same id, on every device,
   * so a friend you add here and the same friend joining the shared room
   * resolve to one person. (FNV-1a over the normalized pair.)
   * ------------------------------------------------------------------ */

  function identityId(name, email) {
    const key = String(email || '').trim().toLowerCase() + '|' + String(name || '').trim().toLowerCase();
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'u_' + h.toString(36);
  }

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // create-or-update the user record for an identity; returns the id
  function upsertUser(name, email) {
    const uid = identityId(name, email);
    const existing = state.users[uid];
    if (existing) {
      if (name) existing.name = name;
      if (email) existing.email = email;
      return uid;
    }
    state.users[uid] = { id: uid, name: name || 'Me', email: email || '', color: C.avatarColor(uid) };
    return uid;
  }

  // stamp a record as modified (used by the sync merge to pick winners)
  function touch(rec) {
    if (rec) rec.updatedAt = new Date().toISOString();
    return rec;
  }

  // remap the demo ledger's placeholder "me" onto the real identity
  function adoptDemoAsMe(uid) {
    const rm = v => (v === 'u_me' ? uid : v);
    for (const g of state.groups) g.members = g.members.map(rm);
    for (const e of state.expenses) {
      e.paidBy = rm(e.paidBy);
      e.splits = e.splits.map(sp => ({ userId: rm(sp.userId), cents: sp.cents }));
    }
    for (const pm of state.payments) { pm.from = rm(pm.from); pm.to = rm(pm.to); }
    for (const c of state.comments) c.userId = rm(c.userId);
    for (const r of state.recurring) r.paidBy = rm(r.paidBy);
    // drop the placeholder record itself: every reference now points at the
    // real identity, and leaving it behind would duplicate the person
    if (uid !== 'u_me') delete state.users.u_me;
  }
  function me() { return user(state.meId); }
  function group(gid) { return state.groups.find(g => g.id === gid); }

  // groups the current user belongs to (Splitwise never shows foreign groups)
  function myGroups(kind) {
    return state.groups.filter(g => (!kind || g.kind === kind) && g.members.includes(state.meId));
  }
  function myExpenses() {
    const ids = new Set(myGroups().map(g => g.id));
    return state.expenses.filter(e => !e.deleted && ids.has(e.groupId));
  }

  function avatar(uid, size) {
    const u = user(uid);
    const px = size || 40;
    const fs = Math.round(px * 0.4);
    if (u.photo) {
      return '<img class="avatar" style="width:' + px + 'px;height:' + px + 'px" src="' + h(u.photo) + '" alt="' + h(u.name) + '" />';
    }
    return '<div class="avatar" style="width:' + px + 'px;height:' + px + 'px;background:' + u.color + ';font-size:' + fs + 'px" title="' + h(u.name) + '">' + h(C.initials(u.name)) + '</div>';
  }

  function avatarStack(g, size) {
    const px = size || 26;
    return '<div class="avatar-stack">' + g.members.slice(0, 4).map(m => avatar(m, px)).join('') +
      (g.members.length > 4 ? '<div class="avatar" style="width:' + px + 'px;height:' + px + 'px;background:var(--bg-subtle);color:var(--text-3);font-size:' + Math.round(px * 0.36) + 'px">+' + (g.members.length - 4) + '</div>' : '') + '</div>';
  }

  function groupTile(g, cls) {
    return '<div class="group-tile ' + (cls || '') + '">' + (g.emoji ? h(g.emoji) : icon('users')) + '</div>';
  }

  function balClass(cents) { return cents > 0 ? 'bal-pos' : cents < 0 ? 'bal-neg' : 'bal-even'; }
  function balBigClass(cents) { return cents > 0 ? 'bal-big-pos' : cents < 0 ? 'bal-big-neg' : 'bal-big-even'; }

  // Splitwise phrasing: "owes you $12.00" / "you owe $12.00" / "settled up"
  function balText(cents, cur) {
    const abs = C.formatMoney(Math.abs(cents), cur);
    if (cents === 0) return 'settled up';
    return cents > 0 ? 'owes you ' + abs : 'you owe ' + abs;
  }

  function groupNetForMe(g) { return C.myGroupNet(state, state.meId, g.id, state.settings.defaultCurrency); }

  function fmtGroupNet(g) {
    const net = groupNetForMe(g);
    if (net === 0) return '<span class="bal-even">settled up</span>';
    const txt = net > 0 ? 'you are owed ' : 'you owe ';
    return '<span class="' + balClass(net) + '">' + txt + C.formatMoney(Math.abs(net), state.settings.defaultCurrency) + '</span>';
  }

  /* ================================================================== *
   * Router & render
   * ================================================================== */

  function isDesktop() {
    return !!(window.matchMedia && window.matchMedia('(min-width: 960px)').matches);
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path] = raw.split('?');
    return path.split('/').filter(Boolean).map(decodeURIComponent);
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    const root = document.getElementById('root');
    if (!root) return;
    if (!state.session) { root.innerHTML = nameScreen(); return; }
    root.innerHTML = appShell();
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function activeTab(parts) {
    const head = parts[0] || 'home';
    if (head === 'group' || head === 'charts' || head === 'groups') return 'groups';
    if (head === 'friend' || head === 'friends') return 'friends';
    if (head === 'activity' || head === 'expense') return 'activity';
    if (head === 'account') return 'account';
    return 'home';
  }

  /* ================================================================== *
   * App shell — sidebar (desktop) + topbar + view + tabbar (mobile) + fab
   * ================================================================== */

  function appShell() {
    const parts = currentRoute();
    const tab = activeTab(parts);
    const r = parts[0] || 'home';

    const screen = screenFor(parts);
    const topbar = screen.topbarHtml !== undefined ? screen.topbarHtml :
      '<header class="topbar">' +
        '<div class="topbar-left">' + (screen.back ? '<button class="icon-btn" data-act="back" aria-label="Back">' + icon('back') + '</button>' : '') + '</div>' +
        '<div class="topbar-title">' + screen.title + '</div>' +
        '<div class="topbar-right">' + (screen.actions || '') + '</div>' +
      '</header>';

    const view = '<main class="view" id="view">' + screen.body + '</main>';

    const tabbar =
      '<nav class="tabbar" aria-label="Main">' +
        tabLink('#/home', 'home', 'Home', tab === 'home') +
        tabLink('#/groups', 'users', 'Groups', tab === 'groups') +
        tabLink('#/friends', 'user', 'Friends', tab === 'friends') +
        tabLink('#/activity', 'activity', 'Activity', tab === 'activity') +
        tabLink('#/account', 'sliders', 'Account', tab === 'account') +
      '</nav>';

    const fab = '<button class="fab" data-act="add-expense" aria-label="Add expense">' + icon('plus') + '</button>';

    const sidebarGroups = myGroups('group');
    const sidebarFriends = myGroups('friend');

    const sidebar =
      '<aside class="sidebar">' +
        logo(30) +
        '<button class="btn btn-primary btn-block" data-act="add-expense">' + icon('plus') + ' Add expense</button>' +
        '<nav class="side-nav">' +
          sideItem('#/home', 'home', 'Dashboard', r === 'home' || r === '') +
          sideItem('#/all-expenses', 'activity', 'All expenses', r === 'all-expenses') +
          sideItem('#/activity', 'clock', 'Recent activity', r === 'activity') +
        '</nav>' +
        '<div class="side-label">Your groups <button class="link-btn" data-act="new-group">Create</button></div>' +
        '<div class="side-scroll"><nav class="side-nav">' +
          sidebarGroups.slice(0, 8).map(g =>
            sideItem('#/group/' + g.id, null, groupTile(g) + '<span class="truncate">' + h(g.name) + '</span>', r === 'group' && parts[1] === g.id)
          ).join('') +
        '</nav></div>' +
        '<div class="side-label">Your friends</div>' +
        '<div class="side-scroll"><nav class="side-nav">' +
          sidebarFriends.slice(0, 8).map(g =>
            sideItem('#/friend/' + g.id, null, avatar(g.members.find(m => m !== state.meId), 26) + '<span class="truncate">' + h(g.name) + '</span>', r === 'friend' && parts[1] === g.id)
          ).join('') +
        '</nav></div>' +
        '<nav class="side-nav mt8">' +
          sideItem('#/all-expenses', 'search', 'All expenses', r === 'all-expenses') +
        '</nav>' +
        '<div class="side-foot"><nav class="side-nav">' +
          sideItem('#/account', 'sliders', 'Account settings', r === 'account') +
          '<button class="side-item" data-act="toggle-theme">' + icon(currentTheme() === 'dark' ? 'sun' : 'moon') + '<span class="truncate">' + (currentTheme() === 'dark' ? 'Light mode' : 'Dark mode') + '</span></button>' +
          '<button class="side-item" data-act="logout">' + icon('logout') + '<span class="truncate">Exit</span></button>' +
        '</nav></div>' +
      '</aside>';

    return '<div class="screen">' + sidebar +
      '<div class="main">' + topbar + view + '</div>' +
      tabbar + fab + '</div>';
  }

  function sideItem(href, ic, label, active) {
    return '<a href="' + href + '"' + (active ? ' class="active"' : '') + '>' +
      (ic ? icon(ic) + '<span class="truncate">' + label + '</span>' : label) + '</a>';
  }

  function tabLink(href, ic, label, active) {
    return '<a href="' + href + '"' + (active ? ' class="active"' : '') + '>' + icon(ic) + '<span>' + label + '</span></a>';
  }

  /* ================================================================== *
   * Screens
   * ================================================================== */

  function notFound(msg) {
    return '<div class="empty">' + icon('inbox') + '<div class="t">' + h(msg) + '</div>' +
      '<a class="btn btn-secondary" href="#/home">Back to dashboard</a></div>';
  }

  function screenFor(parts) {
    const r = parts[0] || 'home';
    switch (r) {
      case 'home': return isDesktop()
        ? { title: 'Dashboard', body: homeScreen() }
        : { title: '', topbarHtml: homeTopbar(), body: homeScreen() };
      case 'groups': return { title: 'Groups', body: groupsScreen() };
      case 'group':
        if (parts[2] === 'settings' && group(parts[1])) {
          return { title: 'Group settings', back: true, body: groupSettingsScreen(parts[1]) };
        }
        return group(parts[1])
          ? { title: h(group(parts[1]).name), back: true, actions: groupActions(parts[1]), body: groupScreen(parts[1]) }
          : { title: 'Groups', back: true, body: notFound('Group not found.') };
      case 'charts':
        return group(parts[1]) ? { title: 'Charts & totals', back: true, body: chartsScreen(parts[1]) } : notFound('Group not found.');
      case 'friends': return { title: 'Friends', body: friendsScreen() };
      case 'friend': {
        const g = group(parts[1]);
        return g && g.kind === 'friend'
          ? { title: h(g.name), back: true, actions: groupActions(g.id), body: groupScreen(parts[1], true) }
          : { title: 'Friends', back: true, body: notFound('Friend not found.') };
      }
      case 'activity': return { title: 'Activity', body: activityScreen() };
      case 'account': return { title: 'Account', body: accountScreen() };
      case 'all-expenses': return { title: 'All expenses', body: allExpensesScreen() };
      case 'expense': {
        const e = state.expenses.find(x => x.id === parts[1] && !x.deleted);
        return e ? { title: 'Expense', back: true, actions: expenseActions(e), body: expenseDetailScreen(e) }
                 : { title: 'Activity', back: true, body: notFound('This expense was deleted.') };
      }
      default: return isDesktop()
        ? { title: 'Not found', body: notFound('Page not found.') }
        : { title: '', topbarHtml: homeTopbar(), body: notFound('Page not found.') };
    }
  }

  function homeTopbar() {
    return '<header class="topbar plain">' +
      '<div class="topbar-left">' + logo(26) + '</div>' +
      '<div class="topbar-title"></div>' +
      '<div class="topbar-right"><a class="icon-btn" href="#/account" aria-label="Account">' + avatar(state.meId, 32) + '</a></div>' +
    '</header>';
  }

  /* ---------------- Home / dashboard ---------------- */

  function homeScreen() {
    const sum = C.overallSummary(state, state.meId, state.settings.defaultCurrency);
    const cur = state.settings.defaultCurrency;
    const groups = myGroups('group');
    const friends = myGroups('friend');

    let sumLine, sumSub;
    if (sum.net === 0) {
      sumLine = '<div class="' + balBigClass(0) + '">You are all settled up</div>';
      sumSub = 'No outstanding balances anywhere.';
    } else if (sum.net > 0) {
      sumLine = '<div class="' + balBigClass(sum.net) + '">You are owed ' + C.formatMoney(sum.net, cur) + '</div>';
      sumSub = 'in total, across ' + state.groups.length + ' ' + (state.groups.length === 1 ? 'group' : 'groups');
    } else {
      sumLine = '<div class="' + balBigClass(sum.net) + '">You owe ' + C.formatMoney(-sum.net, cur) + '</div>';
      sumSub = 'in total, across ' + state.groups.length + ' ' + (state.groups.length === 1 ? 'group' : 'groups');
    }

    const groupsHtml = groups.length
      ? '<div class="card"><div class="rows">' + groups.map(g =>
          '<a class="row" href="#/group/' + g.id + '">' + groupTile(g) +
          '<div class="row-main"><div class="row-title">' + h(g.name) + '</div>' +
          '<div class="row-sub">' + g.members.length + ' members &middot; ' + C.currency(g.currency).code + '</div></div>' +
          '<div class="row-end">' + fmtGroupNet(g) + '</div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></a>').join('') + '</div></div>'
      : emptyCard('No groups yet', 'Create a group for a trip, household or anything you share.', 'new-group', 'Create a group');

    const friendsHtml = friends.length
      ? '<div class="card"><div class="rows">' + friends.map(g => {
          const fid = g.members.find(m => m !== state.meId);
          const net = C.myGroupNet(state, state.meId, g.id, cur);
          return '<a class="row" href="#/friend/' + g.id + '">' + avatar(fid, 40) +
            '<div class="row-main"><div class="row-title">' + h(g.name) + '</div>' +
            '<div class="row-sub">' + balText(net, cur) + '</div></div>' +
            '<span class="row-chevron">' + icon('chevron') + '</span></a>';
        }).join('') + '</div></div>'
      : emptyCard('No friends yet', 'Add a friend to split one-off expenses with them.', 'add-friend', 'Add a friend');

    return '' +
      '<div class="summary">' +
        '<div class="sum-label">Total balance</div>' +
        '<div class="sum-line">' + sumLine + '</div>' +
        '<div class="sum-sub">' + h(sumSub) + '</div>' +
        '<div class="sum-split">' +
          '<div><div class="k">You are owed</div><div class="v amt-pos">' + C.formatMoney(sum.owed, cur) + '</div></div>' +
          '<div><div class="k">You owe</div><div class="v amt-neg">' + C.formatMoney(sum.owe, cur) + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:4px;background:var(--bg)">' +
        '<a class="row" href="#/all-expenses">' +
          '<div class="cat-chip sm" style="background:var(--green-tint-strong);color:var(--green-dark)">' + icon('search') + '</div>' +
          '<div class="row-main"><div class="row-title">All expenses</div>' +
          '<div class="row-sub">Search, filter and export everything</div></div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></a>' +
      '</div>' +
      '<div class="section-head"><h2>Groups</h2><button class="link-btn" data-act="new-group">Create</button></div>' +
      groupsHtml +
      '<div class="section-head"><h2>Friends</h2><button class="link-btn" data-act="add-friend">Add</button></div>' +
      friendsHtml;
  }

  function emptyCard(t, s, act, actLabel) {
    return '<div class="card"><div class="empty">' + icon('inbox') + '<div class="t">' + h(t) + '</div>' +
      '<div class="s">' + h(s) + '</div>' +
      (act ? '<button class="btn btn-secondary" data-act="' + act + '">' + h(actLabel) + '</button>' : '') + '</div></div>';
  }

  /* ---------------- Groups list ---------------- */

  function groupsScreen() {
    const groups = myGroups('group');
    const body = groups.length
      ? '<div class="card"><div class="rows">' + groups.map(g =>
          '<a class="row" href="#/group/' + g.id + '">' + groupTile(g) +
          '<div class="row-main"><div class="row-title">' + h(g.name) + '</div>' +
          '<div class="row-sub">' + g.members.length + ' members &middot; ' + C.currency(g.currency).code + '</div></div>' +
          '<div class="row-end">' + fmtGroupNet(g) + '</div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></a>').join('') + '</div></div>'
      : emptyCard('No groups yet', 'Groups keep trips, households and roommates tidy.', 'new-group', 'Create a group');
    return body +
      '<button class="btn btn-secondary btn-block mt16" data-act="new-group">' + icon('plus') + ' Create a group</button>';
  }

  /* ---------------- Group / friend detail ---------------- */

  function groupActions(gid) {
    return '<button class="icon-btn" data-act="group-settings" data-id="' + gid + '" aria-label="Settings">' + icon('sliders') + '</button>';
  }

  function groupScreen(gid) {
    const g = group(gid);
    if (!g) return notFound('Not found.');
    const bal = C.groupBalances(state, gid);
    const myNet = bal[state.meId] || 0;
    const others = g.members.filter(m => m !== state.meId);
    const cur = g.currency;

    let head =
      '<div class="card card-pad center">' +
        '<div style="display:flex;align-items:center;gap:14px;text-align:left">' +
          groupTile(g) +
          '<div class="grow"><div class="head-font bold" style="font-size:18px">' + h(g.name) + '</div>' +
          '<div class="muted small">' + g.members.length + ' members &middot; ' + C.currency(cur).name + '</div></div>' +
          avatarStack(g, 30) +
        '</div>' +
        '<div class="hr"></div>' +
        '<div class="' + balBigClass(myNet) + '" style="font-size:26px">' +
          (myNet === 0 ? 'You are all settled up'
            : myNet > 0 ? 'You are owed ' + C.formatMoney(myNet, cur)
                        : 'You owe ' + C.formatMoney(-myNet, cur)) +
        '</div>' +
        '<div class="mt8"><button class="btn btn-primary" data-act="add-expense-in" data-id="' + gid + '">' + icon('plus') + ' Add expense</button></div>' +
      '</div>';

    let balancesCard;
    if (g.simplifyDebts && others.some(m => bal[m] !== 0)) {
      const transfers = C.simplifyDebts(bal);
      balancesCard =
        '<div class="card"><div class="card-title">Simplified balances <span class="tag tag-green">Simplify debts on</span></div>' +
        '<div class="rows">' + (transfers.length ? transfers.map(t => {
          const mine = t.from === state.meId || t.to === state.meId;
          const other = t.from === state.meId ? t.to : t.from;
          const who = t.from === state.meId ? 'You pay ' + h(user(t.to).name)
            : t.to === state.meId ? h(user(t.from).name) + ' pays you'
            : h(user(t.from).name) + ' pays ' + h(user(t.to).name);
          return '<div class="row row-static"><div class="row-main"><div class="row-title">' + who + '</div>' +
            '<div class="row-sub">simplified</div></div>' +
            '<div class="row-end"><span class="' + (t.from === state.meId ? 'bal-neg' : t.to === state.meId ? 'bal-pos' : 'bal-even') + '">' + C.formatMoney(t.cents, cur) + '</span>' +
            (mine ? '<button class="btn btn-secondary btn-sm mt8" data-act="settle-with" data-id="' + gid + '" data-with="' + other + '" data-amount="' + t.cents + '">Settle up</button>' : '') + '</div></div>';
        }).join('') : '<div class="row row-static"><div class="row-main"><div class="row-sub">Everyone is settled up.</div></div></div>') + '</div></div>';
    } else {
      balancesCard =
        '<div class="card"><div class="card-title">Balances</div><div class="rows">' +
        others.map(m => {
          const net = (bal[state.meId] || 0) - (bal[m] || 0);
          return '<div class="row row-static">' + avatar(m, 36) +
            '<div class="row-main"><div class="row-title">' + h(user(m).name) + '</div>' +
            '<div class="' + balClass(net) + '">' + balText(net, cur) + '</div></div>' +
            (net === 0 ? '' : '<button class="btn btn-secondary btn-sm" data-act="settle-with" data-id="' + gid + '" data-with="' + m + '" data-amount="' + Math.abs(net) + '">Settle up</button>') +
            '</div>';
        }).join('') + '</div></div>';
    }

    const exps = C.activeExpenses(state, gid).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
    const monthStart = new Date(); monthStart.setDate(1);
    const monthKey = monthStart.toISOString().slice(0, 10);
    const monthExps = exps.filter(e => e.date >= monthKey);
    const monthTotal = monthExps.reduce((a, e) => a + e.amountCents, 0);

    const expensesCard =
      '<div class="card"><div class="card-title">Expenses <span class="muted">' + exps.length + '</span></div>' +
      (exps.length ? '<div class="rows">' + exps.map(e => expenseRow(e, g)).join('') + '</div>' :
        '<div class="empty" style="padding:28px">' + icon('receipt') + '<div class="t">No expenses yet</div>' +
        '<div class="s">Add your first expense to get things rolling.</div>' +
        '<button class="btn btn-primary" data-act="add-expense-in" data-id="' + gid + '">Add expense</button></div>') +
      '</div>';

    const chartsCard =
      '<div class="card"><div class="card-title">This month <button class="link-btn" data-act="charts" data-id="' + gid + '">Charts &amp; totals</button></div>' +
      '<div class="card-pad" style="padding-top:4px">' +
        '<div class="flex between items-center"><div><div class="muted small">Total spent</div>' +
        '<div class="head-font bold" style="font-size:22px">' + C.formatMoney(monthTotal, cur) + '</div></div>' +
        '<span class="tag tag-gray">' + monthExps.length + ' expenses</span></div>' +
      '</div></div>';

    const recurring = state.recurring.filter(r => r.groupId === gid);
    const recurringCard =
      '<div class="card"><div class="card-title">Recurring expenses <span class="tag tag-pro">' + icon('crown') + 'Pro</span></div>' +
      (recurring.length ? '<div class="rows">' + recurring.map(r =>
        '<div class="row row-static">' + catChip(r.categoryId, 'sm') +
        '<div class="row-main"><div class="row-title">' + h(r.description) + '</div>' +
        '<div class="row-sub">' + C.formatMoney(r.amountCents, r.currency) + ' &middot; ' + r.cadence + ' &middot; next ' + C.formatDate(r.nextDate, { relative: false }) + '</div></div>' +
        '<button class="btn btn-secondary btn-sm" data-act="recurring-add" data-id="' + r.id + '">Add now</button></div>').join('') + '</div>'
        : '<div class="row row-static"><div class="row-main"><div class="row-sub">No recurring expenses. Add rent or subscriptions in group settings.</div></div></div>') +
      '</div>';

    return head + balancesCard + expensesCard + chartsCard + recurringCard;
  }

  function expenseRow(e, g) {
    const share = e.splits.find(s => s.userId === state.meId);
    const myShare = share ? share.cents : 0;
    const payer = user(e.paidBy);
    return '<div class="exp-row" data-act="expense" data-id="' + e.id + '">' +
      catChip(e.categoryId) +
      '<div class="grow"><div class="row-title truncate">' + h(e.description) + '</div>' +
      '<div class="who-paid truncate">' + (e.paidBy === state.meId ? 'You' : h(payer.name)) + ' paid ' + C.formatMoney(e.amountCents, e.currency) + ' &middot; ' + C.formatDate(e.date, { relative: true }) + '</div></div>' +
      '<div class="exp-amount">' + C.formatMoney(e.amountCents, e.currency) +
        '<span class="my">' + (e.paidBy === state.meId ? 'you lent ' + C.formatMoney(e.amountCents - myShare, e.currency)
                                                      : 'your share ' + C.formatMoney(myShare, e.currency)) + '</span></div>' +
      '</div>';
  }

  /* ---------------- Friends ---------------- */

  function friendsScreen() {
    const friends = myGroups('friend');
    const body = friends.length
      ? '<div class="card"><div class="rows">' + friends.map(g => {
          const fid = g.members.find(m => m !== state.meId);
          const net = C.myGroupNet(state, state.meId, g.id, state.settings.defaultCurrency);
          return '<a class="row" href="#/friend/' + g.id + '">' + avatar(fid, 40) +
            '<div class="row-main"><div class="row-title">' + h(g.name) + '</div>' +
            '<div class="' + balClass(net) + '">' + balText(net, state.settings.defaultCurrency) + '</div></div>' +
            '<span class="row-chevron">' + icon('chevron') + '</span></a>';
        }).join('') + '</div></div>'
      : emptyCard('No friends yet', 'Add a friend to keep track of one-off shared expenses.', 'add-friend', 'Add a friend');
    return body + '<button class="btn btn-secondary btn-block mt16" data-act="add-friend">' + icon('userPlus') + ' Add a friend</button>';
  }

  /* ---------------- Activity ---------------- */

  function activityScreen() {
    const filters = [['all', 'All'], ['expense', 'Expenses'], ['payment', 'Payments'], ['comment', 'Comments']];
    const entries = activityEntries().filter(en => ui.activityFilter === 'all' || en.type === ui.activityFilter);

    const chips = '<div class="chips mb16">' + filters.map(([k, label]) =>
      '<button class="chip' + (ui.activityFilter === k ? ' on' : '') + '" data-act="activity-filter" data-filter="' + k + '">' + label + '</button>').join('') + '</div>';

    if (!entries.length) {
      return chips + '<div class="card"><div class="empty">' + icon('clock') + '<div class="t">Nothing here yet</div>' +
        '<div class="s">Expenses, payments and comments you make will show up here.</div></div></div>';
    }

    let html = chips + '<div class="card"><div class="rows">';
    let lastDay = null;
    for (const en of entries) {
      if (en.day !== lastDay) {
        lastDay = en.day;
        html += '<div class="card-title" style="padding-top:14px">' + h(en.day) + '</div>';
      }
      html += activityItem(en);
    }
    return html + '</div></div>';
  }

  function activityItem(en) {
    const g = group(en.groupId);
    const sub = (g ? h(g.name) : '') + ' &middot; ' + C.formatDate(en.date.slice(0, 10), { relative: true });
    let amount = '';
    if (en.type === 'expense') {
      const share = (en.data.splits || []).find(s => s.userId === state.meId);
      const my = share ? share.cents : 0;
      const net = en.data.paidBy === state.meId ? en.data.amountCents - my : -my;
      amount = '<div class="act-amt ' + (net >= 0 ? 'amt-pos' : 'amt-neg') + '">' +
        (net >= 0 ? '+' : '') + C.formatMoney(net, en.data.currency) + '</div>';
    } else if (en.type === 'payment') {
      const mine = en.data.from === state.meId ? -1 : 1;
      amount = '<div class="act-amt ' + (mine >= 0 ? 'amt-pos' : 'amt-neg') + '">' +
        (mine >= 0 ? '+' : '') + C.formatMoney(mine * en.data.amountCents, en.data.currency) + '</div>';
    }
    const target = en.type === 'payment' ? en.groupId : en.data.id;
    const act = en.type === 'payment' ? 'group' : 'expense';
    return '<div class="act-item" data-act="' + act + '" data-id="' + target + '">' +
      '<div class="act-icon">' + (en.type === 'payment'
        ? '<div class="cat-chip sm" style="background:var(--green-tint-strong);color:var(--green-dark)">' + icon('dollar') + '</div>'
        : catChip(en.type === 'expense' ? en.data.categoryId : 'general', 'sm')) + '</div>' +
      '<div class="act-body"><div class="act-title">' + en.title + '</div><div class="act-sub">' + sub + '</div></div>' +
      amount + '</div>';
  }

  function activityEntries() {
    const out = [];
    const mine = new Set(myGroups().map(g => g.id));
    for (const e of state.expenses) {
      if (e.deleted || !mine.has(e.groupId)) continue;
      const payer = user(e.paidBy);
      const who = e.paidBy === state.meId ? 'You' : '<b>' + h(payer.name) + '</b>';
      out.push({
        type: 'expense', groupId: e.groupId, date: e.createdAt, day: dayLabel(e.createdAt), data: e,
        title: who + ' added "<b>' + h(e.description) + '</b>"',
      });
    }
    for (const p of state.payments) {
      if (p.deleted || !mine.has(p.groupId)) continue;
      const from = p.from === state.meId ? 'You' : '<b>' + h(user(p.from).name) + '</b>';
      const to = p.to === state.meId ? 'you' : '<b>' + h(user(p.to).name) + '</b>';
      out.push({
        type: 'payment', groupId: p.groupId, date: p.createdAt, day: dayLabel(p.createdAt), data: p,
        title: from + ' paid ' + to + ' ' + C.formatMoney(p.amountCents, p.currency) + (p.method ? ' <span class="muted small">(' + h(p.method) + ')</span>' : ''),
      });
    }
    for (const c of state.comments) {
      const e = state.expenses.find(x => x.id === c.expenseId && !x.deleted);
      if (!e) continue;
      const who = c.userId === state.meId ? 'You' : '<b>' + h(user(c.userId).name) + '</b>';
      out.push({
        type: 'comment', groupId: e.groupId, date: c.createdAt, day: dayLabel(c.createdAt), data: e,
        title: who + ' commented on "<b>' + h(e.description) + '</b>"',
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function dayLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return C.formatDate(iso.slice(0, 10), { relative: false }) + ', ' + d.getFullYear();
  }

  /* ---------------- All expenses ---------------- */

  function allExpensesScreen() {
    const cur = state.settings.defaultCurrency;
    let exps = myExpenses();
    if (ui.allExpFilter.groupId !== 'all') exps = exps.filter(e => e.groupId === ui.allExpFilter.groupId);
    if (ui.allExpFilter.q) {
      const q = ui.allExpFilter.q.toLowerCase();
      exps = exps.filter(e => e.description.toLowerCase().includes(q) || C.category(e.categoryId).name.toLowerCase().includes(q));
    }
    exps.sort((a, b) => (a.date < b.date ? 1 : -1));

    const monthStart = new Date(); monthStart.setDate(1);
    const monthKey = monthStart.toISOString().slice(0, 10);
    const monthTotalUsd = exps.filter(e => e.date >= monthKey)
      .reduce((a, e) => a + C.convertCents(e.amountCents, e.currency, cur), 0);

    const groupChips = '<div class="chips mb16">' +
      '<button class="chip' + (ui.allExpFilter.groupId === 'all' ? ' on' : '') + '" data-act="all-exp-group" data-id="all">All</button>' +
      state.groups.map(g => '<button class="chip' + (ui.allExpFilter.groupId === g.id ? ' on' : '') + '" data-act="all-exp-group" data-id="' + g.id + '">' + h(g.name) + '</button>').join('') +
      '</div>';

    const search = '<div class="field" style="position:relative">' +
      '<input class="input" style="padding-left:42px" placeholder="Search expenses" value="' + h(ui.allExpFilter.q) + '" data-field="all-exp-q" />' +
      '<span style="position:absolute;left:14px;top:13px;color:var(--text-3)">' + icon('search') + '</span></div>';

    const list = exps.length
      ? '<div class="card"><div class="card-title">' + exps.length + ' expenses &middot; this month ' + C.formatMoney(monthTotalUsd, cur) + '</div><div class="rows">' +
        exps.map(e => expenseRow(e, group(e.groupId))).join('') + '</div></div>'
      : '<div class="card"><div class="empty">' + icon('search') + '<div class="t">No matching expenses</div><div class="s">Try a different search or filter.</div></div></div>';

    return search + groupChips + list +
      '<button class="btn btn-secondary btn-block mt16" data-act="export-csv">' + icon('download') + ' Export as CSV</button>';
  }

  /* ---------------- Expense detail ---------------- */

  function expenseActions(e) {
    return '<button class="icon-btn" data-act="edit-expense" data-id="' + e.id + '" aria-label="Edit">' + icon('edit') + '</button>' +
           '<button class="icon-btn" data-act="delete-expense" data-id="' + e.id + '" aria-label="Delete">' + icon('trash') + '</button>';
  }

  function expenseDetailScreen(e) {
    const g = group(e.groupId);
    const cat = C.category(e.categoryId);
    const payer = user(e.paidBy);
    const share = e.splits.find(s => s.userId === state.meId);
    const myShare = share ? share.cents : 0;
    const methodName = (C.SPLIT_METHODS.find(m => m.id === e.splitMethod) || {}).name || e.splitMethod;

    const splitDetail = e.splits.map(s => {
      const net = s.userId === e.paidBy ? e.amountCents - s.cents : -s.cents;
      return '<div class="kv"><span class="k" style="display:flex;align-items:center;gap:8px">' + avatar(s.userId, 24) + h(user(s.userId).name) + (s.userId === state.meId ? ' (you)' : '') + '</span>' +
        '<span class="v">' + C.formatMoney(s.cents, e.currency) +
        (net !== 0 ? ' <span class="' + (net > 0 ? 'amt-pos' : 'amt-neg') + ' small">(' + (net > 0 ? 'gets back ' : 'pays ') + C.formatMoney(Math.abs(net), e.currency) + ')</span>' : '') + '</span></div>';
    }).join('');

    const comments = state.comments.filter(c => c.expenseId === e.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    return '' +
      '<div class="card">' +
        '<div class="detail-hero">' + catChip(e.categoryId, 'lg') +
          '<div class="d-desc">' + h(e.description) + '</div>' +
          '<div class="d-amt">' + C.formatMoney(e.amountCents, e.currency) + '</div>' +
          '<div class="d-meta">' + h(cat.name) + ' &middot; ' + C.formatDate(e.date, { relative: false }) + (g ? ' &middot; ' + h(g.name) : '') + '</div>' +
        '</div>' +
        '<div class="card-pad" style="padding-top:0">' +
          '<div class="kv"><span class="k">Paid by</span><span class="v">' + h(payer.name) + (e.paidBy === state.meId ? ' (you)' : '') + '</span></div>' +
          '<div class="kv"><span class="k">Split</span><span class="v">' + h(methodName) + '</span></div>' +
          '<div class="kv"><span class="k">Your share</span><span class="v">' + C.formatMoney(myShare, e.currency) + '</span></div>' +
          (e.currency !== state.settings.defaultCurrency
            ? '<div class="kv"><span class="k">Your share (' + state.settings.defaultCurrency + ')</span><span class="v">' + C.formatMoney(C.convertCents(myShare, e.currency, state.settings.defaultCurrency), state.settings.defaultCurrency) + '</span></div>'
            : '') +
          (e.notes ? '<div class="kv"><span class="k">Notes</span><span class="v" style="font-weight:400;white-space:pre-wrap">' + h(e.notes) + '</span></div>' : '') +
          (e.receipt ? '<div class="kv"><span class="k">Receipt</span><span class="v"><img src="' + h(e.receipt) + '" alt="Receipt" style="max-width:180px;border-radius:8px;border:1px solid var(--line)" /></span></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-title">Split details</div><div class="card-pad" style="padding-top:0">' + splitDetail + '</div></div>' +
      '<div class="card"><div class="card-title">Comments <span class="muted">' + comments.length + '</span></div>' +
        '<div class="card-pad" style="padding-top:0">' +
          (comments.length ? comments.map(c =>
            '<div class="comment">' + avatar(c.userId, 32) +
            '<div class="c-body"><div class="c-head"><b>' + h(user(c.userId).name) + '</b> &middot; ' + C.formatDate(c.createdAt.slice(0, 10), { relative: true }) + '</div>' +
            '<div class="c-text">' + h(c.text) + '</div></div></div>').join('')
            : '<div class="muted small">No comments yet.</div>') +
          '<form class="comment-form" data-form="comment" data-id="' + e.id + '">' +
            avatar(state.meId, 32) +
            '<input class="input" placeholder="Add a comment" data-field="comment-text" />' +
            '<button class="btn btn-primary btn-sm" type="submit">Post</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap8">' +
        '<button class="btn btn-secondary grow" data-act="edit-expense" data-id="' + e.id + '">' + icon('edit') + ' Edit</button>' +
        '<button class="btn btn-danger grow" data-act="delete-expense" data-id="' + e.id + '">' + icon('trash') + ' Delete</button>' +
      '</div>';
  }

  /* ---------------- Charts ---------------- */

  function chartsScreen(gid) {
    const g = group(gid);
    const cur = g.currency;
    const exps = C.activeExpenses(state, gid);

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const total = exps.filter(e => e.date.slice(0, 7) === key).reduce((a, e) => a + e.amountCents, 0);
      months.push({ key, label: d.toLocaleString('en-US', { month: 'short' }), total });
    }
    const maxMonth = Math.max(1, ...months.map(m => m.total));

    const byCat = {};
    for (const e of exps) byCat[e.categoryId] = (byCat[e.categoryId] || 0) + e.amountCents;
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));

    const byMember = {};
    for (const e of exps) byMember[e.paidBy] = (byMember[e.paidBy] || 0) + e.amountCents;
    const members = Object.entries(byMember).sort((a, b) => b[1] - a[1]);
    const maxMember = Math.max(1, ...members.map(m => m[1]));

    const total = exps.reduce((a, e) => a + e.amountCents, 0);

    return '' +
      '<div class="card"><div class="card-title">Monthly totals <span class="tag tag-pro">' + icon('crown') + 'Pro</span></div>' +
        '<div class="card-pad">' +
          '<div class="bar-chart">' + months.map(m =>
            '<div class="bar-col"><div class="val">' + (m.total ? C.formatMoney(m.total, cur).replace(/\.00$/, '') : '') + '</div>' +
            '<div class="bar' + (m.total ? '' : ' muted') + '" style="height:' + Math.round((m.total / maxMonth) * 100) + '%"></div>' +
            '<div class="lbl">' + m.label + '</div></div>').join('') + '</div>' +
        '</div></div>' +
      '<div class="card"><div class="card-title">By category</div><div class="card-pad">' +
        (cats.length ? cats.map(([cid, amt]) => {
          const c = C.category(cid);
          return '<div class="cat-bar">' + catChip(cid, 'sm') +
            '<div class="cb-main"><div class="flex between"><span class="cb-name">' + h(c.name) + '</span>' +
            '<span class="cb-amt">' + C.formatMoney(amt, cur) + '</span></div>' +
            '<div class="cb-track"><div class="cb-fill" style="width:' + Math.round((amt / maxCat) * 100) + '%;background:' + c.color + '"></div></div></div></div>';
        }).join('') : '<div class="muted small">No expenses yet.</div>') +
      '</div></div>' +
      '<div class="card"><div class="card-title">Who paid</div><div class="card-pad">' +
        (members.length ? members.map(([uid, amt]) =>
          '<div class="cat-bar">' + avatar(uid, 32) +
          '<div class="cb-main"><div class="flex between"><span class="cb-name">' + h(user(uid).name) + '</span>' +
          '<span class="cb-amt">' + C.formatMoney(amt, cur) + '</span></div>' +
          '<div class="cb-track"><div class="cb-fill" style="width:' + Math.round((amt / maxMember) * 100) + '%;background:var(--green-ui)"></div></div></div></div>').join('')
          : '<div class="muted small">No expenses yet.</div>') +
      '</div></div>' +
      '<div class="card card-pad flex between items-center"><div><div class="muted small">All-time total</div>' +
      '<div class="head-font bold" style="font-size:22px">' + C.formatMoney(total, cur) + '</div></div>' +
      '<span class="tag tag-gray">' + exps.length + ' expenses</span></div>';
  }

  /* ---------------- Account ---------------- */

  function accountScreen() {
    const u = me();
    const notif = state.settings.notifications;
    const theme = currentTheme();
    return '' +
      '<div class="card card-pad">' +
        '<div class="flex items-center gap12">' + avatar(state.meId, 64) +
          '<div class="grow"><div class="head-font bold" style="font-size:18px">' + h(u.name) + '</div>' +
          (u.email ? '<div class="muted small">' + h(u.email) + '</div>' : '') + '</div>' +
          '<button class="btn btn-secondary btn-sm" data-act="edit-profile">Edit</button></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title">Preferences</div>' +
        '<div class="rows">' +
          '<div class="row row-static"><div class="row-main"><div class="row-title">Default currency</div>' +
            '<div class="row-sub">Overall balances convert to this currency</div></div>' +
            '<select class="select" style="width:auto;min-width:120px" data-field="default-currency">' +
              Object.values(C.CURRENCIES).map(c => '<option value="' + c.code + '"' + (c.code === state.settings.defaultCurrency ? ' selected' : '') + '>' + c.code + ' &middot; ' + c.symbol + '</option>').join('') +
            '</select></div>' +
          '<div class="row row-static"><div class="row-main"><div class="row-title">Appearance</div>' +
            '<div class="row-sub">Match Splitwise dark mode</div></div>' +
            '<div class="segmented" style="width:190px">' +
              ['light', 'dark', 'system'].map(t => '<button class="' + (theme === t ? 'on' : '') + '" data-act="set-theme" data-theme="' + t + '">' + t[0].toUpperCase() + t.slice(1) + '</button>').join('') +
            '</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title">Notifications</div>' +
        '<div class="rows">' +
          notifRow('email', 'Email summaries', 'Monthly recap of your balances', notif.email) +
          notifRow('push', 'Push notifications', 'When someone adds an expense', notif.push) +
          notifRow('comments', 'Comments', 'When someone comments on your expense', notif.comments) +
        '</div>' +
      '</div>' +

      '<div class="pro-card">' +
        '<h3>' + icon('crown') + ' Splitwise Pro</h3>' +
        '<p>Charts &amp; totals, recurring expenses, receipt scanning, expense search and debt simplification.</p>' +
        '<button class="btn" data-act="pro-upsell">Learn more</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title">Data sync</div>' +
        '<form data-form="sync" class="card-pad" style="padding-top:0">' +
          '<div class="field"><label>Storage mode</label>' +
            '<select class="select" data-field="sync-mode">' +
              '<option value="local"' + (state.sync.mode === 'local' ? ' selected' : '') + '>Local only (this browser)</option>' +
              '<option value="github"' + (state.sync.mode === 'github' ? ' selected' : '') + '>GitHub repo (JSONL file)</option>' +
              '<option value="rest"' + (state.sync.mode === 'rest' ? ' selected' : '') + '>REST endpoint (advanced)</option>' +
            '</select>' +
            '<div class="field-hint">GitHub mode stores your ledger as a JSONL file in a repo \u2014 no cloud service, works in China without a VPN.</div></div>' +

          '<div id="gh-fields"' + (state.sync.mode !== 'github' ? ' hidden' : '') + '>' +
            '<div class="field"><label>Repository</label>' +
              '<input class="input" placeholder="owner/repo (e.g. thulishuang/split-bills-data)" value="' + h(state.sync.ghRepo) + '" data-field="gh-repo" />' +
              '<div class="field-hint">A repo you own. Use a <b>private</b> repo so your ledger stays private.</div></div>' +
            '<div class="field"><label>File path</label>' +
              '<input class="input" placeholder="data/ledger.jsonl" value="' + h(state.sync.ghPath) + '" data-field="gh-path" /></div>' +
            '<div class="field"><label>Branch</label>' +
              '<input class="input" placeholder="main" value="' + h(state.sync.ghBranch) + '" data-field="gh-branch" /></div>' +
            '<div class="field"><label>Access token (classic PAT)</label>' +
              '<input class="input" type="password" placeholder="ghp_... or github_pat_..." value="' + h(state.sync.ghToken) + '" data-field="gh-token" />' +
              '<div class="field-hint">github.com/settings/tokens \u2192 classic token, scope <b>repo</b>. Read-only works without a token for public repos. The token is stored only in this browser.</div></div>' +
          '</div>' +
          '<div class="field" id="sync-url-field"' + (state.sync.mode !== 'rest' ? ' hidden' : '') + '><label>Endpoint URL</label>' +
            '<input class="input" placeholder="https://script.google.com/macros/s/\u2026/exec" value="' + h(state.sync.url) + '" data-field="sync-url" />' +
            '<div class="field-hint">GET (JSONP) returns your ledger; POST saves it. Free backend: see the Apps Script file in the project README.</div></div>' +
          '<div class="field" id="sync-room-field"' + (state.sync.mode !== 'rest' ? ' hidden' : '') + '><label>Room (ledger name)</label>' +
            '<input class="input" placeholder="default" value="' + h(state.sync.room) + '" data-field="sync-room" />' +
            '<div class="field-hint">Everyone using the same room shares one ledger. Different friend circles use different rooms.</div></div>' +
          '<div class="field" id="sync-header-fields"' + (state.sync.mode !== 'rest' ? ' hidden' : '') + '><label>Custom header (optional)</label>' +
            '<div class="flex gap8"><input class="input" placeholder="Header name" value="' + h(state.sync.headerName) + '" data-field="sync-header-name" />' +
            '<input class="input" type="password" placeholder="Value" value="' + h(state.sync.headerValue) + '" data-field="sync-header-value" /></div>' +
            '<div class="field-hint">For services that need a key header (e.g. LeanCloud). Leave empty for Apps Script.</div></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Save sync settings</button>' +
        '</form>' +
        '<div class="rows">' +
          '<button class="row" data-act="sync-now"' + (state.sync.mode !== 'rest' || !state.sync.url ? ' hidden' : '') + ' id="sync-now-row"><div class="row-main"><div class="row-title">Sync now</div><div class="row-sub">Pull from the cloud, then push local changes</div></div><span class="row-chevron">' + icon('repeat') + '</span></button>' +
          '<button class="row" data-act="copy-share-link"' + (state.sync.mode !== 'rest' || !state.sync.url ? ' hidden' : '') + ' id="share-link-row"><div class="row-main"><div class="row-title">Copy share link</div><div class="row-sub">Friends open it and sync starts automatically \u2014 no URL typing</div></div><span class="row-chevron">' + icon('link') + '</span></button>' +
        '</div>' +
        '<div class="card-pad" style="padding-top:0" id="sync-status" aria-live="polite">' + syncStatusHtml() + '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-title">Data</div>' +
        '<div class="rows">' +
          '<button class="row" data-act="export-csv"><div class="row-main"><div class="row-title">Export expenses as CSV</div><div class="row-sub">Spreadsheet-friendly expense list</div></div><span class="row-chevron">' + icon('download') + '</span></button>' +
          '<button class="row" data-act="export-json"><div class="row-main"><div class="row-title">Export full backup (JSON)</div><div class="row-sub">Everything, for moving to another device</div></div><span class="row-chevron">' + icon('download') + '</span></button>' +
          '<label class="row" style="cursor:pointer"><div class="row-main"><div class="row-title">Import backup (JSON)</div><div class="row-sub">Replaces everything on this device</div></div><span class="row-chevron">' + icon('note') + '</span>' +
            '<input type="file" accept="application/json,.json" hidden data-field="import-json" /></label>' +
          '<button class="row" data-act="reset-demo"><div class="row-main"><div class="row-title" style="color:var(--error)">Reset demo data</div><div class="row-sub">Restores the sample trip, apartment and friends</div></div><span class="row-chevron">' + icon('repeat') + '</span></button>' +
          '<button class="row" data-act="logout"><div class="row-main"><div class="row-title">Exit to name screen</div><div class="row-sub">Your data stays in this browser</div></div><span class="row-chevron">' + icon('logout') + '</span></button>' +
        '</div>' +
      '</div>' +

      '<div class="card card-pad center muted small">' +
        '<p style="margin:0 0 6px">Unofficial demo clone of Splitwise, built for the hackathon.</p>' +
        '<p style="margin:0">All data is stored locally in your browser only. Exchange rates are static samples.</p>' +
      '</div>';
  }

  function notifRow(key, title, sub, on) {
    return '<div class="row row-static"><div class="row-main"><div class="row-title">' + h(title) + '</div>' +
      '<div class="row-sub">' + h(sub) + '</div></div>' +
      '<label class="switch"><input type="checkbox" data-notif="' + key + '"' + (on ? ' checked' : '') + ' /><span class="track"></span><span class="thumb"></span></label></div>';
  }

  /* ---------------- Group settings ---------------- */

  function groupSettingsScreen(gid) {
    const g = group(gid);
    if (!g) return notFound('Group not found.');
    const cur = g.currency;
    const recurring = state.recurring.filter(r => r.groupId === gid);

    return '' +
      '<div class="card"><div class="card-title">' + (g.kind === 'friend' ? 'Friend' : 'Group') + '</div>' +
        '<form data-form="group-basic" data-id="' + gid + '" class="card-pad" style="padding-top:0">' +
          (g.kind === 'group' ? '<div class="field"><label>Group name</label><input class="input" value="' + h(g.name) + '" data-field="group-name" /></div>' : '') +
          '<div class="field"><label>Emoji</label><div class="chips">' +
            ['\u{1F5FE}', '\u{1F3E0}', '\u{1F97E}', '✈️', '\u{1F35C}', '\u{1F389}', '\u{1F697}', '\u{1F393}', '⚽', '\u{1F3AE}', '\u{1F436}', '\u{1F4BC}'].map(em =>
              '<button type="button" class="chip' + (g.emoji === em ? ' on' : '') + '" data-act="pick-emoji" data-emoji="' + em + '" data-id="' + gid + '" style="font-size:18px">' + em + '</button>').join('') +
            '<button type="button" class="chip' + (!g.emoji ? ' on' : '') + '" data-act="pick-emoji" data-emoji="" data-id="' + gid + '">None</button>' +
          '</div></div>' +
          '<div class="field"><label>Currency</label><select class="select" data-field="group-currency" data-id="' + gid + '">' +
            Object.values(C.CURRENCIES).map(c => '<option value="' + c.code + '"' + (c.code === cur ? ' selected' : '') + '>' + c.code + ' &middot; ' + c.name + '</option>').join('') +
          '</select><div class="field-hint">All expenses in this group use ' + h(cur) + '.</div></div>' +
          (g.kind === 'group' ? '<button class="btn btn-primary btn-block" type="submit">Save changes</button>' : '') +
        '</form>' +
      '</div>' +

      (g.kind === 'group' ?
      '<div class="card"><div class="card-title">Members <button class="link-btn" data-act="add-member" data-id="' + gid + '">Add</button></div>' +
        '<div class="rows">' + g.members.map(m =>
          '<div class="row row-static">' + avatar(m, 36) +
          '<div class="row-main"><div class="row-title">' + h(user(m).name) + (m === state.meId ? ' (you)' : '') + '</div>' +
          '<div class="row-sub">' + h(user(m).email || '') + '</div></div>' +
          (m !== state.meId && g.members.length > 2 ? '<button class="icon-btn" data-act="remove-member" data-id="' + gid + '" data-uid="' + m + '" aria-label="Remove">' + icon('x') + '</button>' : '') +
          '</div>').join('') + '</div></div>'
      : '') +

      '<div class="card"><div class="card-title">Simplify debts</div>' +
        '<div class="row row-static"><div class="row-main"><div class="row-title">Simplify debts</div>' +
        '<div class="row-sub">Minimize the number of payments needed to settle up</div></div>' +
        '<label class="switch"><input type="checkbox" data-simplify="' + gid + '"' + (g.simplifyDebts ? ' checked' : '') + ' /><span class="track"></span><span class="thumb"></span></label></div>' +
      '</div>' +

      '<div class="card"><div class="card-title">Recurring expenses <span class="tag tag-pro">' + icon('crown') + 'Pro</span></div>' +
        (recurring.length ? '<div class="rows">' + recurring.map(r =>
          '<div class="row row-static">' + catChip(r.categoryId, 'sm') +
          '<div class="row-main"><div class="row-title">' + h(r.description) + '</div>' +
          '<div class="row-sub">' + C.formatMoney(r.amountCents, r.currency) + ' &middot; ' + r.cadence + ' &middot; next ' + C.formatDate(r.nextDate, { relative: false }) + '</div></div>' +
          '<button class="icon-btn" data-act="recurring-del" data-id="' + r.id + '" aria-label="Delete">' + icon('trash') + '</button></div>').join('') + '</div>'
          : '<div class="row row-static"><div class="row-main"><div class="row-sub">No recurring expenses yet.</div></div></div>') +
        '<div class="card-pad" style="padding-top:0"><button class="btn btn-secondary btn-block" data-act="recurring-new" data-id="' + gid + '">' + icon('plus') + ' Add recurring expense</button></div>' +
      '</div>' +

      '<div class="card card-pad">' +
        (g.kind === 'friend'
          ? '<button class="btn btn-danger btn-block" data-act="delete-friend" data-id="' + gid + '">Remove friend</button>'
          : '<button class="btn btn-danger btn-block" data-act="delete-group" data-id="' + gid + '">Delete group</button>') +
        '<div class="field-hint center mt8">' + (g.kind === 'friend'
          ? 'Removes this friend and their shared expense history from this device.'
          : 'Deletes the group and all of its expenses from this device.') + '</div>' +
      '</div>';
  }

  /* ================================================================== *
   * Name entry screen — no account, no password. Just a name.
   * ================================================================== */

  function nameScreen() {
    return '' +
      '<div class="auth">' +
        '<div class="auth-hero"><div class="auth-hero-inner">' +
          logo(44, true) +
          '<h1>Less stress when sharing expenses with anyone.</h1>' +
          '<p>Keep track of your shared expenses and balances with housemates, trips, groups, friends, and family.</p>' +
        '</div></div>' +
        '<div class="auth-body">' +
          '<form data-form="name" id="name-form">' +
            '<div class="field"><label>Your name</label>' +
              '<input class="input" id="auth-name" placeholder="e.g. Alex Morgan" autocomplete="name" /></div>' +
            '<div class="field"><label>Email</label>' +
              '<input class="input" id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" />' +
              '<div class="field-hint">Name + email is your identity \u2014 the same pair always resolves to the same account, on any device.</div></div>' +
            '<button class="btn btn-primary btn-block btn-lg" type="button" data-act="enter-app" data-mode="demo">Start recording</button>' +
          '</form>' +
          '<div class="auth-alt">or</div>' +
          '<button class="btn btn-secondary btn-block mt16" data-act="enter-app" data-mode="blank">Start with an empty ledger</button>' +
          '<div class="auth-foot">No account needed &middot; everything stays in this browser</div>' +
        '</div>' +
      '</div>';
  }

  // enter the app: `mode` is 'demo' (sample data) or 'blank' (empty ledger)
  function enterApp(mode) {
    const nameEl = document.getElementById('auth-name');
    const emailEl = document.getElementById('auth-email');
    const name = (nameEl && nameEl.value ? nameEl.value : '').trim() || 'Me';
    const email = (emailEl && emailEl.value ? emailEl.value : '').trim();
    if (!email || !EMAIL_RE.test(email)) {
      showToast('Enter a valid email \u2014 name + email is your identity');
      const el = document.getElementById('auth-email');
      if (el) el.focus();
      return;
    }
    const uid = upsertUser(name, email);
    if (mode === 'blank') {
      state.groups = [];
      state.expenses = [];
      state.payments = [];
      state.comments = [];
      state.recurring = [];
      state.meId = uid;
    } else {
      // first run on this device: build the sample ledger around this identity
      if (!state.groups.length) {
        seedDemo();                 // replaces state wholesale...
        adoptDemoAsMe(uid);         // ...so re-add this identity afterwards
        state.users[uid] = { id: uid, name: name, email: email, color: C.avatarColor(uid) };
      }
      state.meId = uid;
    }
    state.session = { name, email };
    commit();
    go('#/home');
    showToast('Welcome, ' + name);
  }

/* ================================================================== *
 * Sheets (bottom sheet on mobile, centered modal on desktop)
 * ================================================================== */

  function openSheet(opts) {
    ui.sheets.push(Object.assign({ title: '', wide: false }, opts));
    renderSheetRoot();
  }

  function closeSheet() {
    const top = ui.sheets.pop();
    if (top && top.onClose) top.onClose();
    renderSheetRoot();
  }

  function replaceSheetBody(html) {
    const top = ui.sheets[ui.sheets.length - 1];
    if (top) { top.bodyHtml = html; renderSheetRoot(); }
  }

  function renderSheetRoot() {
    const root = document.getElementById('sheet-root');
    if (!root) return;
    if (!ui.sheets.length) { root.innerHTML = ''; return; }
    const s = ui.sheets[ui.sheets.length - 1];
    root.innerHTML =
      '<div class="sheet-backdrop" data-act="sheet-backdrop">' +
        '<div class="sheet' + (s.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + h(s.title) + '">' +
          '<div class="sheet-head">' +
            '<button class="icon-btn" data-act="sheet-close" aria-label="Close">' + icon('x') + '</button>' +
            '<div class="t">' + h(s.title) + '</div>' +
            (s.headRight || '<span style="width:40px"></span>') +
          '</div>' +
          '<div class="sheet-body">' + (s.bodyHtml || '') + '</div>' +
          (s.footHtml ? '<div class="sheet-foot">' + s.footHtml + '</div>' : '') +
        '</div>' +
      '</div>';
  }

  /* ---------------- Expense form (add / edit) ---------------- */

  function openExpenseSheet(opts) {
    const editing = !!opts.expenseId;
    const exp = editing ? state.expenses.find(e => e.id === opts.expenseId) : null;
    const gid = exp ? exp.groupId : (opts.groupId || (state.groups[0] || {}).id);
    const g = group(gid);
    if (!g) { showToast('Create a group first'); return; }

    ui.draft = {
      expenseId: exp ? exp.id : null,
      groupId: gid,
      description: exp ? exp.description : '',
      amountCents: exp ? exp.amountCents : 0,
      categoryId: exp ? exp.categoryId : 'general',
      paidBy: exp ? exp.paidBy : state.meId,
      date: exp ? exp.date : C.todayISO(),
      notes: exp ? (exp.notes || '') : '',
      receipt: exp ? (exp.receipt || '') : '',
      splitMethod: exp ? exp.splitMethod : 'equal',
      participants: g.members.map(m => {
        const prev = exp ? exp.splits.find(s => s.userId === m) : null;
        return {
          userId: m,
          on: exp ? !!prev : true,
          value: prev ? centsToInput(prev.cents, exp.splitMethod) : defaultSplitValue(exp ? exp.splitMethod : 'equal'),
        };
      }),
    };

    openSheet({
      title: editing ? 'Edit expense' : 'Add expense',
      wide: true,
      bodyHtml: expenseFormHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-expense">' +
        (editing ? 'Save changes' : 'Save') + '</button>' +
        (editing ? '<button class="btn btn-ghost btn-block mt8" style="color:var(--error)" data-act="delete-expense" data-id="' + exp.id + '">Delete expense</button>' : ''),
    });
  }

  function defaultSplitValue(method) {
    if (method === 'shares') return '1';
    if (method === 'adjustment') return '0';
    return '';
  }

  function centsToInput(cents, method) {
    // percentages are stored as cents; approximate back to a percent on edit
    if (method === 'percent') return '0';
    return (cents / 100).toFixed(2);
  }

  function expenseFormHtml() {
    const d = ui.draft;
    const g = group(d.groupId);
    if (!g) return '<div class="empty">Group not found.</div>';
    const methodName = (C.SPLIT_METHODS.find(m => m.id === d.splitMethod) || {}).name;
    const cat = C.category(d.categoryId);

    return '' +
      '<div class="field"><label>Group</label>' +
        '<select class="select" data-field="draft-group">' +
          state.groups.map(x => '<option value="' + x.id + '"' + (x.id === d.groupId ? ' selected' : '') + '>' +
            (x.kind === 'friend' ? '\u{1F464} ' : '') + h(x.name) + ' &middot; ' + C.currency(x.currency).code + '</option>').join('') +
        '</select></div>' +

      '<div class="field"><label>Description</label>' +
        '<input class="input" placeholder="Dinner, rent, gas&hellip;" value="' + h(d.description) + '" data-field="draft-description" /></div>' +

      '<div class="field"><label>Amount</label>' +
        '<div class="amount-wrap"><span class="cur">' + C.currency(g.currency).symbol + '</span>' +
        '<input class="amount-input" inputmode="decimal" placeholder="0.00" value="' + (d.amountCents ? (d.amountCents / 100).toFixed(2) : '') + '" data-field="draft-amount" aria-label="Amount" /></div></div>' +

      '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);margin-bottom:18px">' +
        '<button type="button" class="row" data-act="pick-category">' + catChip(d.categoryId) +
          '<div class="row-main"><div class="row-title">' + h(cat.name) + '</div><div class="row-sub">Category</div></div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></button>' +
        '<button type="button" class="row" data-act="pick-payer">' + avatar(d.paidBy, 34) +
          '<div class="row-main"><div class="row-title">Paid by ' + h(user(d.paidBy).name) + '</div>' +
          '<div class="row-sub">' + (d.paidBy === state.meId ? 'You fronted the money' : 'lent the money') + '</div></div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></button>' +
        '<button type="button" class="row" data-act="open-split">' +
          '<div class="cat-chip">' + icon('scale') + '</div>' +
          '<div class="row-main"><div class="row-title">' + h(methodName) + '</div>' +
          '<div class="row-sub">' + splitSummary() + '</div></div>' +
          '<span class="row-chevron">' + icon('chevron') + '</span></button>' +
        '<div class="row row-static">' + '<div class="cat-chip">' + icon('calendar') + '</div>' +
          '<div class="row-main"><div class="row-title">Date</div>' +
          '<div class="row-sub">' + C.formatDate(d.date, { relative: true }) + '</div></div>' +
          '<input type="date" value="' + h(d.date) + '" data-field="draft-date" style="border:none;background:transparent;color:var(--green-deep);font-weight:700;font-family:var(--font-head)" />' +
        '</div>' +
      '</div>' +

      '<div class="field"><label>Notes</label>' +
        '<textarea class="textarea" placeholder="Add a note" data-field="draft-notes">' + h(d.notes) + '</textarea></div>' +

      '<div class="field"><label>Receipt</label>' +
        (d.receipt ? '<div style="position:relative;display:inline-block"><img src="' + h(d.receipt) + '" style="max-width:150px;border-radius:var(--radius);border:1px solid var(--line)" alt="Receipt" />' +
          '<button class="icon-btn" data-act="remove-receipt" style="position:absolute;top:-8px;right:-8px;background:var(--bg);border:1px solid var(--line)">' + icon('x') + '</button></div>'
         : '<label class="btn btn-secondary" style="cursor:pointer">' + icon('receipt') + ' Attach receipt' +
           '<input type="file" accept="image/*" hidden data-field="draft-receipt" /></label>') +
        '<div class="field-hint">Stored locally in your browser.</div></div>';
  }

  function splitSummary() {
    const d = ui.draft;
    const on = d.participants.filter(p => p.on);
    const n = on.length;
    const people = n + (n === 1 ? ' person' : ' people');
    if (d.splitMethod === 'equal') return people + ', split equally';
    if (d.splitMethod === 'exact') return people + ', exact amounts';
    if (d.splitMethod === 'adjustment') return people + ', adjusted amounts';
    if (d.splitMethod === 'percent') return people + ', by percentage';
    return people + ', by shares';
  }

  /* ---------------- Split editor ---------------- */

  function openSplitSheet() {
    const d = ui.draft;
    if (!d) return;
    openSheet({
      title: 'Split',
      wide: true,
      bodyHtml: splitEditorHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="split-done">Done</button>',
    });
  }

  function splitEditorHtml() {
    const d = ui.draft;
    const g = group(d.groupId);
    const on = d.participants.filter(p => p.on);
    const n = on.length || 1;

    const segs = C.SPLIT_METHODS.map(m =>
      '<button class="' + (d.splitMethod === m.id ? 'on' : '') + '" data-act="split-method" data-method="' + m.id + '">' + h(m.short || m.name) + '</button>').join('');

    const unit = d.splitMethod === 'percent' ? '%'
      : d.splitMethod === 'shares' ? 'shares'
      : d.splitMethod === 'adjustment' ? '\u00B1' + C.currency(g.currency).symbol
      : C.currency(g.currency).symbol;

    // live preview
    const preview = d.amountCents ? C.computeSplit(d.splitMethod, d.amountCents, on) : null;
    const previewMap = {};
    if (preview && preview.splits) for (const s of preview.splits) previewMap[s.userId] = s.cents;

    const rows = g.members.map(m => {
      const p = d.participants.find(x => x.userId === m);
      const shown = p && p.on;
      let right = '';
      if (shown) {
        if (d.splitMethod === 'equal') {
          right = '<input class="num" readonly value="' + (previewMap[m] != null ? C.formatMoney(previewMap[m], g.currency) : C.formatMoney(0, g.currency)) + '" tabindex="-1" />';
        } else {
          right = '<div style="display:flex;align-items:center;gap:6px">' +
            '<span class="muted small">' + unit + '</span>' +
            '<input class="num" inputmode="decimal" value="' + h(p.value) + '" data-part-value="' + m + '" placeholder="0" /></div>';
        }
      }
      return '<div class="split-row">' +
        '<label class="check"><input type="checkbox" data-part-on="' + m + '"' + (shown ? ' checked' : '') + ' /><span class="box">' + icon('check') + '</span></label>' +
        avatar(m, 32) +
        '<div class="who">' + h(user(m).name) + (m === state.meId ? ' <span class="sub">(you)</span>' : '') +
        (d.splitMethod === 'adjustment' && shown && preview && preview.base ? '<div class="sub">equal share ' + C.formatMoney(preview.base.find(b => b.userId === m).cents, g.currency) + '</div>' : '') +
        '</div>' +
        right +
        '</div>';
    }).join('');

    let hint = '';
    if (d.amountCents) {
      if (preview && !preview.ok && preview.error) hint = '<div class="field-err">' + h(preview.error) + '</div>';
      else if (preview && preview.pctRemaining !== undefined && preview.pctRemaining !== 0) {
        hint = '<div class="field-hint">' + preview.pctRemaining + '% remaining</div>';
      } else hint = '<div class="field-hint">All set &mdash; ' + C.formatMoney(d.amountCents, g.currency) + ' fully allocated.</div>';
    } else {
      hint = '<div class="field-hint">Enter an amount to preview the split.</div>';
    }

    return '' +
      '<div class="segmented" style="margin-bottom:16px;flex-wrap:wrap">' + segs + '</div>' +
      rows +
      '<div class="mt16">' + hint + '</div>';
  }

  /* ---------------- Category picker ---------------- */

  function openCategorySheet() {
    openSheet({
      title: 'Select a category',
      bodyHtml: '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
        C.CATEGORIES.map(c =>
          '<button class="card card-pad" style="margin:0;padding:14px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer" data-act="pick-category-go" data-id="' + c.id + '">' +
          '<div class="cat-chip" style="background:' + c.color + ';color:' + c.ink + '">' + glyph(c.glyph) + '</div>' +
          '<span style="font-size:12px;font-weight:600;text-align:center">' + h(c.name) + '</span></button>').join('') +
        '</div>',
    });
  }

  /* ---------------- Payer picker ---------------- */

  function openPayerSheet() {
    const d = ui.draft;
    const g = group(d.groupId);
    openSheet({
      title: 'Paid by',
      bodyHtml: '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden">' +
        g.members.map(m =>
          '<button class="row" data-act="pick-payer-go" data-id="' + m + '">' + avatar(m, 36) +
          '<div class="row-main"><div class="row-title">' + h(user(m).name) + (m === state.meId ? ' (you)' : '') + '</div></div>' +
          (d.paidBy === m ? '<span style="color:var(--green-deep)">' + icon('check') + '</span>' : '') +
          '</button>').join('') + '</div>',
    });
  }

  /* ---------------- Settle up ---------------- */

  const PAY_METHODS = ['Cash', 'PayPal', 'Venmo', 'Bank transfer', 'Alipay', 'WeChat Pay', 'Other'];

  function openSettleSheet(opts) {
    const g = group(opts.groupId);
    if (!g) return;
    const withId = opts.with || g.members.find(m => m !== state.meId);
    const bal = C.groupBalances(state, g.id);
    const net = (bal[state.meId] || 0) - (bal[withId] || 0); // + => they owe me
    ui.settleDraft = {
      groupId: g.id,
      with: withId,
      dir: net >= 0 ? 'receive' : 'pay',   // default direction from the balance
      amountCents: opts.amount != null ? opts.amount : Math.abs(net),
      method: PAY_METHODS[0],
      date: C.todayISO(),
      note: '',
    };
    openSheet({
      title: 'Settle up',
      wide: true,
      bodyHtml: settleHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-payment">Record payment</button>',
    });
  }

  function settleHtml() {
    const d = ui.settleDraft;
    const g = group(d.groupId);
    const other = user(d.with);
    const pay = d.dir === 'pay';
    return '' +
      '<div class="center mb16">' +
        '<div class="muted small">' + (pay ? 'You are paying' : 'You are receiving from') + '</div>' +
        '<div class="flex items-center gap12" style="justify-content:center;margin-top:8px">' +
          avatar(state.meId, 44) +
          '<span style="font-family:var(--font-head);font-weight:700;color:var(--green-deep)">' + (pay ? '\u2192' : '\u2190') + '</span>' +
          avatar(d.with, 44) +
        '</div>' +
        '<div class="head-font bold mt8">' + h(other.name) + '</div>' +
        '<div class="segmented mt16" style="max-width:280px;margin-left:auto;margin-right:auto">' +
          '<button class="' + (!pay ? 'on' : '') + '" data-act="settle-dir" data-dir="receive">They pay you</button>' +
          '<button class="' + (pay ? 'on' : '') + '" data-act="settle-dir" data-dir="pay">You pay them</button>' +
        '</div>' +
      '</div>' +

      '<div class="field"><label>Amount</label>' +
        '<div class="amount-wrap"><span class="cur">' + C.currency(g.currency).symbol + '</span>' +
        '<input class="amount-input" inputmode="decimal" value="' + (d.amountCents ? (d.amountCents / 100).toFixed(2) : '') + '" data-field="settle-amount" aria-label="Amount" /></div>' +
        '<div class="field-hint">Balance between you and ' + h(other.name) + ': ' +
          balText(C.pairwiseBalance(state, g.id, state.meId, d.with), g.currency) + '</div></div>' +

      '<div class="field"><label>Payment method</label><div class="chips">' +
        PAY_METHODS.map(m => '<button type="button" class="chip' + (d.method === m ? ' on' : '') + '" data-act="settle-method" data-method="' + h(m) + '">' + h(m) + '</button>').join('') +
        '</div></div>' +

      '<div class="field"><label>Date</label>' +
        '<input class="input" type="date" value="' + h(d.date) + '" data-field="settle-date" /></div>' +

      '<div class="field"><label>Note</label>' +
        '<input class="input" placeholder="What was this for?" value="' + h(d.note) + '" data-field="settle-note" /></div>';
  }

  /* ---------------- Group / friend create ---------------- */

  function openGroupSheet(kind) {
    ui.groupDraft = {
      id: null,
      kind: kind || 'group',
      name: '',
      email: '',
      emoji: kind === 'friend' ? '' : '\u{1F389}',
      currency: state.settings.defaultCurrency,
      members: [state.meId],
    };
    openSheet({
      title: kind === 'friend' ? 'Add a friend' : 'Create a group',
      wide: true,
      bodyHtml: groupFormHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-group">' +
        (kind === 'friend' ? 'Add friend' : 'Create group') + '</button>',
    });
  }

  function groupFormHtml() {
    const d = ui.groupDraft;
    const candidates = Object.values(state.users).filter(u => u.id !== state.meId);
    return '' +
      (d.kind === 'group' ?
        '<div class="field"><label>Group name</label>' +
        '<input class="input" placeholder="Trip to Japan" value="' + h(d.name) + '" data-field="group-name" /></div>' : '') +

      '<div class="field"><label>' + (d.kind === 'friend' ? 'Friend name' : 'Emoji') + '</label>' +
        (d.kind === 'friend'
          ? '<input class="input" placeholder="Sam Rivera" value="' + h(d.name) + '" data-field="friend-name" />' +
            '<div class="field" style="margin-top:12px"><label>Friend email</label>' +
            '<input class="input" type="email" placeholder="sam@example.com" value="' + h(d.email || '') + '" data-field="friend-email" />' +
            '<div class="field-hint">Their name + email becomes their identity \u2014 if they ever join the same room, everything lines up.</div></div>'
          : '<div class="chips">' +
            ['\u{1F5FE}', '\u{1F3E0}', '\u{1F97E}', '✈️', '\u{1F35C}', '\u{1F389}', '\u{1F697}', '\u{1F393}', '⚽', '\u{1F3AE}', '\u{1F436}', '\u{1F4BC}'].map(em =>
              '<button type="button" class="chip' + (d.emoji === em ? ' on' : '') + '" data-act="pick-group-emoji" data-emoji="' + em + '" style="font-size:18px">' + em + '</button>').join('') +
            '</div>') +
      '</div>' +

      (d.kind === 'group' ?
        '<div class="field"><label>Currency</label><select class="select" data-field="group-currency">' +
          Object.values(C.CURRENCIES).map(c => '<option value="' + c.code + '"' + (c.code === d.currency ? ' selected' : '') + '>' + c.code + ' &middot; ' + c.name + '</option>').join('') +
        '</select></div>' : '') +

      '<div class="field"><label>Members</label>' +
        '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden">' +
          candidates.map(u =>
            '<div class="row row-static">' + avatar(u.id, 34) +
            '<div class="row-main"><div class="row-title">' + h(u.name) + '</div>' +
            '<div class="row-sub">' + h(u.email || '') + '</div></div>' +
            '<label class="check"><input type="checkbox" data-member="' + u.id + '"' + (d.members.includes(u.id) ? ' checked' : '') + ' /><span class="box">' + icon('check') + '</span></label>' +
            '</div>').join('') +
        '</div>' +
        '<div class="field-hint">Pick people you already know, or add someone new by name + email below.</div></div>' +

      '<div class="field"><label>Add someone new</label>' +
        '<div class="flex gap8">' +
          '<input class="input" placeholder="Name" data-field="new-person-name" />' +
          '<input class="input" type="email" placeholder="Email" data-field="new-person-email" />' +
        '</div>' +
        '<button type="button" class="btn btn-secondary btn-block mt8" data-act="add-new-person">' + icon('userPlus') + ' Add person</button>' +
        '<div class="field-hint">No invite is sent \u2014 the person is added to this ledger directly.</div></div>';
  }

  /* ---------------- Add member to group ---------------- */

  function openMemberSheet(gid) {
    const g = group(gid);
    if (!g) return;
    ui.memberDraft = { groupId: gid, selected: [] };
    openSheet({
      title: 'Add members',
      wide: true,
      bodyHtml: memberSheetHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-members">Add to group</button>',
    });
  }

  function memberSheetHtml() {
    const d = ui.memberDraft;
    const g = group(d.groupId);
    const outside = Object.values(state.users).filter(u => !g.members.includes(u.id));
    return '' +
      '<div class="field"><label>Add an existing person</label>' +
        (outside.length ? '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden">' +
          outside.map(u =>
            '<div class="row row-static">' + avatar(u.id, 34) +
            '<div class="row-main"><div class="row-title">' + h(u.name) + '</div>' +
            '<div class="row-sub">' + h(u.email || '') + '</div></div>' +
            '<label class="check"><input type="checkbox" data-member="' + u.id + '"' + (d.selected.includes(u.id) ? ' checked' : '') + ' /><span class="box">' + icon('check') + '</span></label>' +
            '</div>').join('') + '</div>'
          : '<div class="muted small">Everyone you know is already in this group.</div>') +
      '</div>' +
      '<div class="field"><label>Add someone new</label>' +
        '<div class="flex gap8">' +
          '<input class="input" placeholder="Name" data-field="new-person-name" />' +
          '<input class="input" type="email" placeholder="Email" data-field="new-person-email" />' +
        '</div>' +
        '<button type="button" class="btn btn-secondary btn-block mt8" data-act="add-new-person">' + icon('userPlus') + ' Add person</button>' +
        '<div class="field-hint">No invite is sent \u2014 name + email creates their identity and adds them to this group.</div></div>';
  }

  /* ---------------- Profile edit ---------------- */

  function openProfileSheet() {
    const u = me();
    ui.profileDraft = { name: u.name, email: u.email || '', color: u.color || '#1CC29F', photo: u.photo || '' };
    openSheet({
      title: 'Edit profile',
      wide: true,
      bodyHtml: profileHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-profile">Save</button>',
    });
  }

  function profileHtml() {
    const d = ui.profileDraft;
    return '' +
      '<div class="center mb16">' +
        (d.photo ? '<img src="' + h(d.photo) + '" class="avatar" style="width:84px;height:84px" alt="Avatar" />'
                 : '<div class="avatar" style="width:84px;height:84px;background:' + d.color + ';font-size:32px">' + h(C.initials(d.name)) + '</div>') +
        '<div class="mt8"><label class="btn btn-secondary btn-sm" style="cursor:pointer">Change photo' +
        '<input type="file" accept="image/*" hidden data-field="profile-photo" /></label> ' +
        (d.photo ? '<button class="btn btn-ghost btn-sm" data-act="remove-photo">Remove</button>' : '') + '</div>' +
      '</div>' +
      '<div class="field"><label>Your name</label>' +
        '<input class="input" value="' + h(d.name) + '" data-field="profile-name" /></div>' +
      '<div class="field"><label>Email (your identity)</label>' +
        '<input class="input" value="' + h(d.email) + '" readonly style="background:var(--bg-2);color:var(--text-3)" />' +
        '<div class="field-hint">Name + email is your account. To change it, exit to the name screen and enter the new pair.</div></div>' +
      '<div class="field"><label>Avatar color</label><div class="chips">' +
        ['#1CC29F', '#9153D2', '#F96817', '#EE87A0', '#1D856C', '#7B44B5', '#D34508', '#18A582'].map(c =>
          '<button type="button" class="chip" style="width:38px;height:38px;padding:0;border-radius:999px;background:' + c + ';border:3px solid ' + (d.color === c ? 'var(--text)' : 'transparent') + '" data-act="pick-color" data-color="' + c + '" aria-label="Color"></button>').join('') +
        '</div></div>';
  }

  /* ---------------- Recurring expense ---------------- */

  function openRecurringSheet(gid) {
    const g = group(gid);
    ui.recurringDraft = {
      groupId: gid,
      description: '',
      amountCents: 0,
      categoryId: 'general',
      paidBy: state.meId,
      cadence: 'monthly',
      nextDate: nextMonth(),
    };
    openSheet({
      title: 'Recurring expense',
      wide: true,
      bodyHtml: recurringHtml(),
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="save-recurring">Add recurring</button>',
    });
  }

  function recurringHtml() {
    const d = ui.recurringDraft;
    const g = group(d.groupId);
    return '' +
      '<div class="field"><label>Description</label>' +
        '<input class="input" placeholder="Rent, Netflix, wifi&hellip;" value="' + h(d.description) + '" data-field="rec-description" /></div>' +
      '<div class="field"><label>Amount</label>' +
        '<div class="amount-wrap"><span class="cur">' + C.currency(g.currency).symbol + '</span>' +
        '<input class="amount-input" inputmode="decimal" value="' + (d.amountCents ? (d.amountCents / 100).toFixed(2) : '') + '" data-field="rec-amount" /></div></div>' +
      '<div class="field"><label>Category</label><select class="select" data-field="rec-category">' +
        C.CATEGORIES.map(c => '<option value="' + c.id + '"' + (c.id === d.categoryId ? ' selected' : '') + '>' + h(c.name) + '</option>').join('') +
        '</select></div>' +
      '<div class="field"><label>Cadence</label><select class="select" data-field="rec-cadence">' +
        ['weekly', 'monthly', 'yearly'].map(c => '<option value="' + c + '"' + (c === d.cadence ? ' selected' : '') + '>' + c + '</option>').join('') +
        '</select></div>' +
      '<div class="field"><label>Next date</label>' +
        '<input class="input" type="date" value="' + h(d.nextDate) + '" data-field="rec-next" /></div>' +
      '<div class="field"><label>Paid by</label><select class="select" data-field="rec-payer">' +
        g.members.map(m => '<option value="' + m + '"' + (m === d.paidBy ? ' selected' : '') + '>' + h(user(m).name) + '</option>').join('') +
        '</select></div>';
  }

  /* ---------------- Pro upsell ---------------- */

  function openProSheet() {
    openSheet({
      title: 'Splitwise Pro',
      bodyHtml:
        '<div class="center mb16"><div class="cat-chip lg" style="background:var(--pro-soft);color:var(--pro-deep);margin:0 auto 12px">' + icon('crown') + '</div>' +
        '<div class="head-font bold" style="font-size:18px">Unlock the full experience</div>' +
        '<div class="muted small mt8">Everything in this demo is already unlocked.</div></div>' +
        '<div class="rows" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden">' +
        ['Charts & totals', 'Recurring expenses', 'Receipt scanning', 'Expense search', 'Simplify debts', 'Currency conversion'].map(t =>
          '<div class="row row-static"><span style="color:var(--green-deep)">' + icon('check') + '</span><div class="row-main"><div class="row-title">' + h(t) + '</div></div></div>').join('') +
        '</div>',
      footHtml: '<button class="btn btn-primary btn-block btn-lg" data-act="sheet-close">Maybe later</button>',
    });
  }

  /* ---------------- Confirm dialog ---------------- */

  let confirmResolver = null;
  function confirmSheet(opts) {
    openSheet({
      title: opts.title || 'Are you sure?',
      bodyHtml: '<div class="confirm-card"><div class="s">' + h(opts.message || '') + '</div>' +
        '<div class="btns"><button class="btn btn-secondary" data-act="confirm-no">Cancel</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="confirm-yes">' + h(opts.confirmLabel || 'Confirm') + '</button></div></div>',
    });
    return new Promise(resolve => { confirmResolver = resolve; });
  }

  /* ---------------- Toast ---------------- */

  let toastTimer = null;
  function showToast(msg, action) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = '<div class="toast">' + h(msg) +
      (action ? ' <button class="link-btn" style="color:var(--green-tint-strong);margin-left:6px" data-act="toast-action">' + h(action.label) + '</button>' : '') +
      '</div>';
    if (action) {
      const btn = root.querySelector('[data-act="toast-action"]');
      if (btn) btn.addEventListener('click', () => {
        action.fn();
        root.innerHTML = '';
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, action ? 5000 : 2600);
  }

  /* ================================================================== *
   * Mutations
   * ================================================================== */

  function saveExpenseFromDraft() {
    const d = ui.draft;
    if (!d) return { ok: false, error: 'No draft' };
    if (!d.amountCents || d.amountCents <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
    const g = group(d.groupId);
    if (!g) return { ok: false, error: 'Pick a group.' };

    const on = d.participants.filter(p => p.on);
    if (!on.length) return { ok: false, error: 'Select at least one participant.' };

    const result = C.computeSplit(d.splitMethod, d.amountCents, on);
    if (!result.ok) return { ok: false, error: result.error || 'Fix the split before saving.' };

    const payload = {
      groupId: d.groupId,
      description: (d.description || '').trim() || 'Untitled expense',
      amountCents: d.amountCents,
      currency: g.currency,
      categoryId: d.categoryId,
      paidBy: d.paidBy,
      date: d.date || C.todayISO(),
      notes: (d.notes || '').trim(),
      receipt: d.receipt || '',
      splitMethod: d.splitMethod,
      splits: result.splits,
    };

    if (d.expenseId) {
      const e = state.expenses.find(x => x.id === d.expenseId);
      if (e) { Object.assign(e, payload); touch(e); }
      showToast('Expense updated');
    } else {
      state.expenses.push(Object.assign({ id: C.id('e'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, payload));
      showToast('Expense added');
    }
    commit();
    return { ok: true };
  }

  function recordPaymentFromDraft() {
    const d = ui.settleDraft;
    if (!d) return { ok: false, error: 'No draft' };
    if (!d.amountCents || d.amountCents <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
    const from = d.dir === 'pay' ? state.meId : d.with;
    const to = d.dir === 'pay' ? d.with : state.meId;
    state.payments.push({
      id: C.id('p'),
      groupId: d.groupId,
      from, to,
      amountCents: d.amountCents,
      currency: group(d.groupId).currency,
      date: d.date || C.todayISO(),
      method: d.method,
      note: (d.note || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    commit();
    showToast('Payment recorded');
    return { ok: true };
  }

  function deleteExpense(expenseId) {
    const e = state.expenses.find(x => x.id === expenseId);
    if (!e) return;
    e.deleted = true;
    touch(e);
    commit();
    showToast('Expense deleted', {
      label: 'Undo',
      fn: () => { e.deleted = false; touch(e); commit(); showToast('Expense restored'); },
    });
  }

  function saveGroupFromDraft() {
    const d = ui.groupDraft;
    if (!d) return { ok: false, error: 'No draft' };
    const name = (d.name || '').trim();
    if (!name) return { ok: false, error: 'Enter a name.' };
    const members = d.members.length ? d.members : [state.meId];
    if (!members.includes(state.meId)) members.push(state.meId);

    if (d.kind === 'friend') {
      const email = (d.email || '').trim();
      if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email for your friend.' };
      const fid = upsertUser(name, email);
      const gid = C.id('f');
      state.groups.push({
        id: gid, kind: 'friend', name, emoji: '',
        currency: state.settings.defaultCurrency,
        members: [state.meId, fid], simplifyDebts: false,
        createdAt: new Date().toISOString(), createdBy: state.meId,
        updatedAt: new Date().toISOString(),
      });
      commit();
      showToast('Friend added');
      go('#/friend/' + gid);
      return { ok: true };
    }
    const gid = C.id('g');
    state.groups.push({
      id: gid, kind: 'group', name, emoji: d.emoji || '',
      currency: d.currency || state.settings.defaultCurrency,
      members, simplifyDebts: false,
      createdAt: new Date().toISOString(), createdBy: state.meId,
      updatedAt: new Date().toISOString(),
    });
    commit();
    showToast('Group created');
    go('#/group/' + gid);
    return { ok: true };
  }

  function saveMembersFromDraft() {
    const d = ui.memberDraft;
    const g = group(d.groupId);
    if (!g) return;
    for (const uid of d.selected) {
      if (!g.members.includes(uid)) g.members.push(uid);
      const p = ui.draft;
      if (p && p.groupId === g.id) {
        if (!p.participants.some(x => x.userId === uid)) {
          p.participants.push({ userId: uid, on: true, value: defaultSplitValue(p.splitMethod) });
        }
      }
    }
    touch(g);
    commit();
    showToast(d.selected.length + ' member' + (d.selected.length === 1 ? '' : 's') + ' added');
    return { ok: true };
  }

  function saveProfileFromDraft() {
    const d = ui.profileDraft;
    const u = me();
    u.name = (d.name || '').trim() || u.name;
    u.email = (d.email || '').trim();
    u.color = d.color;
    u.photo = d.photo || '';
    touch(u);
    commit();
    showToast('Profile saved');
  }

  function saveRecurringFromDraft() {
    const d = ui.recurringDraft;
    if (!d.description.trim()) return { ok: false, error: 'Enter a description.' };
    if (!d.amountCents) return { ok: false, error: 'Enter an amount.' };
    state.recurring.push({
      id: C.id('r'),
      groupId: d.groupId,
      description: d.description.trim(),
      amountCents: d.amountCents,
      currency: group(d.groupId).currency,
      categoryId: d.categoryId,
      paidBy: d.paidBy,
      splitMethod: 'equal',
      cadence: d.cadence,
      nextDate: d.nextDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    commit();
    showToast('Recurring expense added');
    return { ok: true };
  }

  function recurringAddNow(recId) {
    const r = state.recurring.find(x => x.id === recId);
    if (!r) return;
    const g = group(r.groupId);
    const parts = C.distributeEqual(r.amountCents, g.members.length);
    state.expenses.push({
      id: C.id('e'),
      groupId: r.groupId,
      description: r.description,
      amountCents: r.amountCents,
      currency: r.currency,
      categoryId: r.categoryId,
      paidBy: r.paidBy,
      date: C.todayISO(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      splitMethod: 'equal',
      splits: g.members.map((m, i) => ({ userId: m, cents: parts[i] })),
      notes: 'Added from recurring expense',
    });
    commit();
    showToast('Expense added from recurring');
  }

  // full-device backup: everything except the current session
  function backupObject() {
    const copy = JSON.parse(JSON.stringify(state));
    copy.session = null;
    copy.exportedAt = new Date().toISOString();
    return copy;
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // shared shape check for backups and cloud payloads
  function validateBackup(parsed) {
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Not a valid backup.' };
    if (parsed.version !== 1) return { ok: false, error: 'Unsupported backup version.' };
    if (!parsed.users || typeof parsed.users !== 'object') return { ok: false, error: 'Backup has no users.' };
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.expenses)) return { ok: false, error: 'Backup is missing groups or expenses.' };
    return { ok: true };
  }

  // validate + restore a backup; keeps the current session/name
  function importBackup(parsed) {
    const v = validateBackup(parsed);
    if (!v.ok) return v;
    const session = state.session;
    const settings = state.settings;
    state.users = parsed.users;
    state.groups = parsed.groups;
    state.expenses = parsed.expenses;
    state.payments = Array.isArray(parsed.payments) ? parsed.payments : [];
    state.comments = Array.isArray(parsed.comments) ? parsed.comments : [];
    state.recurring = Array.isArray(parsed.recurring) ? parsed.recurring : [];
    if (parsed.settings) state.settings = parsed.settings;
    // keep the signed-in identity if it still exists in the backup
    if (session) {
      if (state.users[state.meId]) state.session = session;
      else {
        const first = Object.keys(state.users)[0];
        if (first) { state.meId = first; state.session = session; }
        else state.session = session;
      }
    }
    commit();
    return { ok: true };
  }

  /* ================================================================== *
   * Cloud sync — localStorage stays the cache; an optional REST endpoint
   * becomes the source of truth. GET = JSONP pull, POST = push.
   * Works with the bundled Apps Script backend, LeanCloud, or any URL
   * that returns the ledger JSON and accepts a POST of it.
   * ================================================================== */

  const SYNC_DEBOUNCE_MS = 1200;
  let syncTimer = null;
  let syncInFlight = false;
  let syncSeq = 0;

  function syncEnabled() {
    if (!state.sync) return false;
    if (state.sync.mode === 'rest') return !!state.sync.url;
    if (state.sync.mode === 'github') return ghConfigured();
    return false;
  }

  function syncRoom() {
    return (state.sync.room || '').trim() || 'default';
  }

  function syncPayload() {
    const copy = backupObject();
    copy.meId = state.meId;
    copy.room = syncRoom();
    copy.updatedAt = state.updatedAt;
    return copy;
  }

  // append a line to the visible sync log (kept short, newest first)
  function syncLog(kind, detail) {
    if (!state.sync.log) state.sync.log = [];
    state.sync.log.unshift({ at: new Date().toISOString(), kind: kind, detail: detail || '' });
    if (state.sync.log.length > 8) state.sync.log.length = 8;
    save();
    updateSyncStatusDom();
  }

  function setSyncStatus(status, err) {
    if (!state.sync) return;
    state.sync.status = status;
    state.sync.lastError = err || '';
    save();
    updateSyncStatusDom();
  }

  function updateSyncStatusDom() {
    const el = document.getElementById('sync-status');
    if (el) el.innerHTML = syncStatusHtml();
  }

  function syncStatusHtml() {
    const sy = state.sync;
    const local = '<div class="muted small">Local only &mdash; data lives in this browser. ' +
      'Pick a storage mode above to sync across phone and desktop.</div>';
    if (!sy || (sy.mode !== 'rest' && sy.mode !== 'github')) return local;
    if (sy.mode === 'rest' && !sy.url) return local;
    if (sy.mode === 'github' && !ghConfigured()) return local;

    let html = '';
    if (sy.mode === 'github' && sy.ghPrivate === false) {
      html += '<div class="field-err" style="background:var(--owe-tint);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:8px">' +
        '<b>This repository is public</b> \u2014 anyone with the URL can read your ledger. ' +
        'Switch Repository to a private repo before recording real expenses.</div>';
    }

    const tag = sy.status === 'syncing' ? '<span class="tag tag-gray">syncing&hellip;</span>'
      : sy.status === 'ok' ? '<span class="tag tag-green">synced</span>'
      : sy.status === 'error' ? '<span class="tag tag-orange">sync error</span>' : '';
    html += '<div class="flex between items-center"><div>' + tag + '</div>' +
      '<div class="muted tiny">' + (sy.lastSyncAt ? 'last sync ' + C.formatDate(sy.lastSyncAt.slice(0, 10), { relative: true }) + ' ' + C.formatTime(sy.lastSyncAt) : 'never synced') + '</div></div>' +
      (sy.lastError ? '<div class="field-err">' + h(sy.lastError) + '</div>' : '');

    if (sy.mode === 'github') {
      html += '<div class="field-hint truncate" title="' + h(sy.ghRepo + ' / ' + sy.ghPath) + '">' +
        h(sy.ghRepo + ' \u2192 ' + sy.ghPath + ' (' + (sy.ghBranch || 'main') + ')') + '</div>' +
        '<div class="field-hint">' + (sy.ghPrivate === true ? 'private repo \u2713' : sy.ghPrivate === false ? '<b style="color:var(--owe)">public repo</b>' : 'visibility unknown') +
        (ghEncryptOn() ? ' &middot; <b style="color:var(--owed-strong)">encrypted \u2713</b>' : '') +
        ' &middot; auto-syncs on every change, checks the repo every ' + (sy.ghToken ? '60s' : '5min') + '</div>';
    } else {
      const short = sy.url.length > 58 ? sy.url.slice(0, 58) + '\u2026' : sy.url;
      html += '<div class="field-hint truncate" title="' + h(sy.url) + '">' + h(short) + '</div>' +
        '<div class="field-hint">room: <b>' + h(syncRoom()) + '</b> &middot; auto-syncs on every change, checks the cloud every 60s</div>';
    }

    if (sy.log && sy.log.length) {
      html += '<div class="mt8" style="border-top:1px solid var(--line);padding-top:8px">';
      for (const line of sy.log) {
        const t = C.formatTime(line.at);
        const color = line.kind === 'error' ? 'var(--error)' : line.kind === 'skip' ? 'var(--owe)' : 'var(--text-3)';
        html += '<div class="tiny" style="color:' + color + ';font-family:var(--font-head)">' + h(t) + ' &middot; ' + h(line.kind) + (line.detail ? ' &middot; ' + h(line.detail) : '') + '</div>';
      }
      html += '</div>';
    }
    return html;
  }

  function syncHeaders() {
    const hdrs = {};
    if (state.sync.headerName && state.sync.headerValue) hdrs[state.sync.headerName] = state.sync.headerValue;
    return hdrs;
  }

  // push the whole ledger; no-cors keeps simple endpoints (Apps Script) happy
  async function syncPush() {
    if (!syncEnabled() || typeof fetch !== 'function') return { ok: false, error: 'not configured' };
    if (syncInFlight) return { ok: false, error: 'busy' };
    syncInFlight = true;
    const my = ++syncSeq;
    setSyncStatus('syncing');
    try {
      const body = JSON.stringify(syncPayload());
      if (body.length > 900000) {
        setSyncStatus('error', 'ledger is ' + Math.round(body.length / 1024) + ' KB — too large for this endpoint; remove big receipt images');
        syncInFlight = false;
        return { ok: false, error: 'payload too large' };
      }
      const hasHeader = state.sync.headerName && state.sync.headerValue;
      await fetch(state.sync.url, {
        method: 'POST',
        mode: hasHeader ? 'cors' : 'no-cors',
        headers: syncHeaders(),
        body: body,
      });
      if (my !== syncSeq) { syncInFlight = false; return { ok: true }; }
      state.sync.lastSyncAt = new Date().toISOString();
      setSyncStatus('ok');
      syncLog('push', Math.round(body.length / 1024) + ' KB sent');
      return { ok: true };
    } catch (e) {
      if (my === syncSeq) { setSyncStatus('error', String((e && e.message) || e)); syncLog('error', 'push failed'); }
      return { ok: false, error: String((e && e.message) || e) };
    } finally {
      syncInFlight = false;
    }
  }

  // JSONP GET: script-tag loads are not blocked by CORS
  function jsonpGet(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const cb = '__splitPull_' + Math.random().toString(36).slice(2, 10);
      const script = document.createElement('script');
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true; cleanup(); reject(new Error('pull timeout'));
      }, timeoutMs || 12000);
      function cleanup() {
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = data => {
        if (done) return;
        done = true; clearTimeout(timer); cleanup();
        resolve(data);
      };
      script.onerror = () => {
        if (done) return;
        done = true; clearTimeout(timer); cleanup();
        reject(new Error('could not load endpoint'));
      };
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      script.src = url + sep + 'callback=' + cb + '&t=' + Date.now() + '&room=' + encodeURIComponent(syncRoom());
      (document.head || document.body || document.documentElement).appendChild(script);
    });
  }

  /* ------------------------------------------------------------------ *
   * Record-level merge. Instead of replacing the whole ledger with the
   * cloud copy (which loses whatever this device added since the last
   * sync), we union every collection by record id and keep the newer
   * version of each record. Deletions win over undeleted copies.
   * This is what makes two phones adding expenses to the same room both
   * survive, instead of the last writer erasing the other.
   * ------------------------------------------------------------------ */

  function newerRec(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (!!a.deleted !== !!b.deleted) return a.deleted ? a : b;
    const at = a.updatedAt || a.createdAt || '';
    const bt = b.updatedAt || b.createdAt || '';
    return bt > at ? b : a;
  }

  // returns true when local state changed
  function mergeBackup(remote) {
    let changed = false;
    const stamp = rec => { changed = true; return rec; };

    for (const u of Object.values(remote.users || {})) {
      const local = state.users[u.id];
      if (!local) { state.users[u.id] = stamp(u); continue; }
      const win = newerRec(local, u);
      if (win !== local) state.users[u.id] = stamp(win);
    }

    const mergeArr = (localArr, key) => {
      const byId = {};
      for (const r of localArr) byId[r.id] = r;
      for (const r of (remote[key] || [])) {
        const win = newerRec(byId[r.id], r);
        if (win !== byId[r.id]) byId[r.id] = stamp(win);
        else if (!byId[r.id]) byId[r.id] = stamp(r);
      }
      return Object.values(byId);
    };

    state.groups = mergeArr(state.groups, 'groups');
    state.expenses = mergeArr(state.expenses, 'expenses');
    state.payments = mergeArr(state.payments, 'payments');
    state.comments = mergeArr(state.comments, 'comments');
    state.recurring = mergeArr(state.recurring, 'recurring');
    return changed;
  }

  // never yank the screen away while the user is typing or a sheet is open
  function syncBusy() {
    if (ui.sheets && ui.sheets.length) return true;
    const ae = document.activeElement;
    if (ae && ae.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return true;
    return false;
  }

  async function syncPull(opts) {
    if (!syncEnabled()) return { ok: false, error: 'sync not configured' };
    if (typeof fetch !== 'function') return { ok: false, error: 'fetch unavailable' };
    const force = opts && opts.force;
    setSyncStatus('syncing');
    try {
      const remote = await jsonpGet(state.sync.url);
      const v = validateBackup(remote);
      if (!v.ok) { setSyncStatus('error', v.error); syncLog('error', v.error); return v; }
      if (!force && syncBusy()) {
        // busy: don't re-render under the user's hands; retry shortly
        setSyncStatus('ok');
        syncLog('skip', 'cloud checked while you were busy — will apply when you stop typing');
        setTimeout(() => { if (!syncBusy()) syncPull({ force: true }); }, 4000);
        return { ok: true, deferred: true };
      }
      const changed = mergeBackup(remote);
      state.updatedAt = new Date().toISOString();
      state.sync.lastSyncAt = new Date().toISOString();
      if (changed) {
        commit();
        syncLog('pull', 'merged cloud changes');
      } else {
        save();
        syncLog('pull', 'cloud already up to date');
      }
      setSyncStatus('ok');
      // converge: push the merged result so every device ends up identical
      const pushed = await syncPush();
      return pushed.ok ? { ok: true, adopted: changed } : pushed;
    } catch (e) {
      const msg = String((e && e.message) || e);
      setSyncStatus('error', msg);
      syncLog('error', msg);
      return { ok: false, error: msg };
    }
  }

  // push after a local change (mode-aware)
  function autoSync() {
    if (state.sync.mode === 'github') ghSync();
    else if (state.sync.mode === 'rest') syncPush();
  }

  // how often to re-check the remote (mode-aware)
  function syncPollMs() {
    if (state.sync.mode === 'github') return state.sync.ghToken ? 60000 : 300000;
    return 60000;
  }

  function remoteSync(opts) {
    return state.sync.mode === 'github' ? ghSync(opts) : syncPull(opts);
  }

  function scheduleAutoSync() {
    if (!syncEnabled()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { autoSync(); }, SYNC_DEBOUNCE_MS);
  }

  function saveSyncSettings(fields) {
    state.sync.mode = (fields.mode === 'rest' || fields.mode === 'github') ? fields.mode : 'local';
    state.sync.url = (fields.url || '').trim();
    state.sync.room = (fields.room || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    state.sync.headerName = (fields.headerName || '').trim();
    state.sync.headerValue = fields.headerValue || '';
    if (fields.ghRepo !== undefined) {
      state.sync.ghRepo = (fields.ghRepo || '').trim()
        .replace(/^https?:\/\/github\.com\//, '')
        .replace(/\/+$/, '')
        .replace(/\.git$/, '');
    }
    if (fields.ghPath !== undefined) state.sync.ghPath = (fields.ghPath || 'data/ledger.jsonl').trim().replace(/^\/+/, '');
    if (fields.ghBranch !== undefined) state.sync.ghBranch = (fields.ghBranch || 'main').trim();
    if (fields.ghToken !== undefined) state.sync.ghToken = (fields.ghToken || '').trim();
    if (fields.ghPass !== undefined) state.sync.ghPass = fields.ghPass || '';
    commit();
  }

  // link that pre-configures sync for whoever opens it
  function shareLink() {
    const base = location.origin + location.pathname;
    if (state.sync.mode === 'github') {
      // never put the token in a link: friends paste their own token
      return base + '#ghrepo=' + encodeURIComponent(state.sync.ghRepo) +
        '&ghpath=' + encodeURIComponent(state.sync.ghPath) +
        '&ghbranch=' + encodeURIComponent(state.sync.ghBranch);
    }
    return base + '#endpoint=' + encodeURIComponent(state.sync.url) +
      '&room=' + encodeURIComponent(syncRoom());
  }

  /* ================================================================== *
   * GitHub-as-database mode — no cloud service, no VPN.
   * The ledger lives in the repo as one JSON object per line (JSONL):
   *   {"t":"expense","id":"e_1",...,"updatedAt":"..."}
   * Folding the file = union by id, newest updatedAt wins, deletions win.
   * Reads are plain GETs (public repos need no token at all); writes use
   * the Contents API with the blob sha, so a stale sha is rejected (409)
   * and we re-read, merge, and retry instead of clobbering a friend's edit.
   * ================================================================== */

  const GH_API = 'https://api.github.com';

  function b64ToUtf8(b64) {
    const bin = atob(String(b64 || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  // Ask GitHub whether the ledger repo is public. A public repo means anyone
  // with the URL can read the ledger, so the UI says so out loud.
  async function ghCheckVisibility(force) {
    const sy = state.sync;
    if (!ghConfigured()) return null;
    const now = Date.now();
    if (!force && sy.ghVisibilityAt && now - sy.ghVisibilityAt < 600000) return sy.ghPrivate;
    try {
      const res = await fetch(GH_API + '/repos/' + sy.ghRepo, { headers: ghHeaders() });
      if (!res.ok) return sy.ghPrivate;
      const d = await res.json();
      sy.ghPrivate = !!d.private;
      sy.ghVisibilityAt = now;
      save();
      updateSyncStatusDom();
      return sy.ghPrivate;
    } catch (e) {
      return sy.ghPrivate;
    }
  }

  function ghConfigured() {
    const sy = state.sync;
    return sy.mode === 'github' && /^[^/\s]+\/[^/\s]+$/.test(sy.ghRepo || '') && !!sy.ghPath;
  }

  function ghHeaders(extra) {
    const hdrs = Object.assign({ Accept: 'application/vnd.github+json' }, extra || {});
    if (state.sync.ghToken) hdrs.Authorization = 'Bearer ' + state.sync.ghToken;
    return hdrs;
  }

  function ghUrl(suffix) {
    const sy = state.sync;
    return GH_API + '/repos/' + sy.ghRepo + '/contents/' +
      sy.ghPath.replace(/^\/+/, '') + (suffix || '');
  }

  // fold JSONL lines into a state-shaped object (collections + users)
  // record type ("expense") -> state collection ("expenses")
  const GH_TYPES = {
    user: 'users', group: 'groups', expense: 'expenses',
    payment: 'payments', comment: 'comments', recurring: 'recurring',
  };

  function parseJsonl(text) {
    const out = { users: {}, groups: [], expenses: [], payments: [], comments: [], recurring: [] };
    const seen = {};
    for (const line of String(text || '').split('\n')) {
      const t = line.trim();
      if (!t || t[0] !== '{') continue;
      let rec;
      try { rec = JSON.parse(t); } catch (e) { continue; }
      if (!rec || !rec.t || !rec.id || !GH_TYPES[rec.t]) continue;
      const key = rec.t + ':' + rec.id;
      const prev = seen[key];
      if (prev && (prev.updatedAt || '') >= (rec.updatedAt || '')) continue;
      seen[key] = rec;
    }
    for (const rec of Object.values(seen)) {
      const coll = GH_TYPES[rec.t];
      if (coll === 'users') out.users[rec.id] = rec;
      else out[coll].push(rec);
    }
    return out;
  }

  function toJsonl(stateObj) {
    const lines = [];
    for (const u of Object.values(stateObj.users || {})) {
      lines.push(JSON.stringify(Object.assign({ t: 'user' }, u)));
    }
    for (const type of Object.keys(GH_TYPES)) {
      const coll = GH_TYPES[type];
      if (coll === 'users') continue;
      for (const rec of (stateObj[coll] || [])) {
        lines.push(JSON.stringify(Object.assign({ t: type }, rec)));
      }
    }
    return lines.join('\n') + '\n';
  }

  /* ---------------- optional at-rest encryption ----------------
   * With a passphrase set, the JSONL is encrypted (AES-256-GCM, key derived
   * with PBKDF2-SHA256) before it is committed, so even a PUBLIC repo only
   * ever holds ciphertext. The file stays self-describing:
   *   {"enc":1,"salt":"...","iv":"...","data":"<base64 ciphertext>"}
   * Losing the passphrase loses the ledger — there is no recovery.
   * ----------------------------------------------------------- */

  function ghEncryptOn() { return !!state.sync.ghPass; }

  // raw bytes -> base64 (btoa takes a binary string). utf8ToB64 must NOT be
  // used here: it would re-encode every byte >127 as multi-byte UTF-8.
  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(String(b64 || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function subtle() {
    return (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  }

  async function ghDeriveKey(saltBytes) {
    const ct = subtle();
    if (!ct) throw new Error('WebCrypto unavailable');
    const material = await ct.importKey(
      'raw', new TextEncoder().encode(state.sync.ghPass), 'PBKDF2', false, ['deriveKey']);
    return ct.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: 150000, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function ghEncryptJsonl(text) {
    const ct = subtle();
    if (!ct) throw new Error('WebCrypto unavailable');
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await ghDeriveKey(salt);
    const cipher = new Uint8Array(await ct.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text)));
    return JSON.stringify({
      enc: 1, kdf: 'pbkdf2-sha256', iter: 150000,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      data: bytesToB64(cipher),
    });
  }

  function isEncryptedBlob(text) {
    const t = String(text || '').trim();
    if (!t || t[0] !== '{') return false;
    try { const o = JSON.parse(t.split('\n')[0]); return o && o.enc === 1 && !!o.data; } catch (e) { return false; }
  }

  async function ghDecryptBlob(text) {
    const ct = subtle();
    if (!ct) throw new Error('WebCrypto unavailable');
    const wrapper = JSON.parse(String(text).trim().split('\n')[0]);
    const salt = b64ToBytes(wrapper.salt);
    const iv = b64ToBytes(wrapper.iv);
    const data = b64ToBytes(wrapper.data);
    const key = await ghDeriveKey(salt);
    const plain = await ct.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    return new TextDecoder().decode(plain);
  }

  // GET the file; returns { ok, sha, state } (404 = brand-new ledger)
  async function ghGet() {
    let res;
    try {
      res = await fetch(ghUrl('?ref=' + encodeURIComponent(state.sync.ghBranch || 'main')), { headers: ghHeaders() });
    } catch (e) {
      return { ok: false, error: 'network error: ' + ((e && e.message) || e) };
    }
    if (res.status === 404) return { ok: true, sha: null, state: parseJsonl('') };
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const when = reset ? new Date(reset * 1000).toLocaleTimeString() : 'later';
      return { ok: false, error: 'GitHub API rate limit reached, resets at ' + when };
    }
    if (!res.ok) return { ok: false, error: 'GitHub GET ' + res.status + ' ' + res.statusText };
    let data;
    try { data = await res.json(); } catch (e) { return { ok: false, error: 'bad GitHub response' }; }
    if (data.type !== 'file') return { ok: false, error: 'path is not a file' };
    let text = data.content ? b64ToUtf8(data.content) : '';
    if (isEncryptedBlob(text)) {
      if (!ghEncryptOn()) {
        return { ok: false, error: 'This ledger is encrypted \u2014 enter the ledger passphrase in Data sync.' };
      }
      try {
        text = await ghDecryptBlob(text);
      } catch (e) {
        return { ok: false, error: 'Could not decrypt \u2014 wrong passphrase?' };
      }
    }
    return { ok: true, sha: data.sha, state: parseJsonl(text) };
  }

  async function ghPut(sha, jsonl, message) {
    const body = {
      message: message || 'split-bills: sync ledger',
      content: utf8ToB64(jsonl),
      branch: state.sync.ghBranch || 'main',
    };
    if (sha) body.sha = sha;
    let res;
    try {
      res = await fetch(ghUrl(), {
        method: 'PUT',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, error: 'network error: ' + ((e && e.message) || e) };
    }
    if (res.status === 409) return { ok: false, conflict: true };
    if (res.status === 403 || res.status === 401) {
      let msg = 'GitHub rejected the write (' + res.status + ')';
      if (res.status === 401) msg = 'Token invalid or expired (401)';
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        const reset = res.headers.get('x-ratelimit-reset');
        msg = 'GitHub API rate limit reached, resets at ' + (reset ? new Date(reset * 1000).toLocaleTimeString() : 'later');
      }
      return { ok: false, error: msg };
    }
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.message || ''; } catch (e) {}
      return { ok: false, error: 'GitHub PUT ' + res.status + ' ' + (detail || res.statusText) };
    }
    return { ok: true };
  }

  // full sync cycle: read -> merge -> write, retrying on sha conflicts
  async function ghSync(opts) {
    const force = opts && opts.force;
    if (!ghConfigured()) return { ok: false, error: 'GitHub sync not configured' };
    if (typeof fetch !== 'function' || typeof btoa !== 'function') return { ok: false, error: 'browser APIs unavailable' };
    if (!force && syncBusy()) {
      setSyncStatus('ok');
      syncLog('skip', 'repo checked while you were busy \u2014 will apply when you stop typing');
      setTimeout(() => { if (!syncBusy()) ghSync({ force: true }); }, 4000);
      return { ok: true, deferred: true };
    }
    setSyncStatus('syncing');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const got = await ghGet();
      if (!got.ok) { setSyncStatus('error', got.error); syncLog('error', got.error); return got; }
      const changed = mergeBackup(got.state);
      state.updatedAt = new Date().toISOString();
      state.sync.lastSyncAt = new Date().toISOString();
      if (changed) { commit(); syncLog('pull', 'merged repo changes'); }
      else { save(); }
      if (!state.sync.ghToken) {
        // read-only without a token: keep the repo as the source of truth for others
        setSyncStatus('ok');
        syncLog('pull', changed ? 'merged repo changes (read-only, no token)' : 'repo up to date (read-only, no token)');
        return { ok: true, adopted: changed, readOnly: true };
      }
      let body;
      try {
        body = ghEncryptOn() ? await ghEncryptJsonl(toJsonl(state)) : toJsonl(state);
      } catch (e) {
        setSyncStatus('error', 'encryption failed: ' + ((e && e.message) || e));
        return { ok: false, error: 'encryption failed' };
      }
      const put = await ghPut(got.sha, body);
      if (put.ok) {
        setSyncStatus('ok');
        syncLog('push', toJsonl(state).split('\n').length + ' lines committed' + (ghEncryptOn() ? ' (encrypted)' : ''));
        return { ok: true, adopted: changed };
      }
      if (put.conflict && attempt < 3) {
        syncLog('retry', 'someone else committed first \u2014 merging and retrying');
        continue;
      }
      setSyncStatus('error', put.error);
      syncLog('error', put.error);
      return put;
    }
    return { ok: false, error: 'could not commit after 3 attempts' };
  }

  function exportCsv() {
    const csv = C.expensesToCsv(state, state.meId);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'splitwise-expenses.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
    showToast('CSV exported');
  }

  function copyText(text, msg) {
    const done = () => showToast(msg || 'Copied');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('Copy failed'); }
    ta.remove();
  }

/* ================================================================== *
 * Event delegation — clicks, inputs, changes, submits
 * ================================================================== */

  const $ = sel => document.querySelector(sel);
  const val = sel => { const el = $(sel); return el ? el.value.trim() : ''; };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const id = t.dataset.id;

    // clicking anywhere INSIDE a sheet must not close it;
    // only a click on the backdrop area itself (e.target === backdrop) closes
    if (act === 'sheet-backdrop') {
      if (t === e.target) closeSheet();
      return;
    }

    switch (act) {
      case 'back':
        if (history.length > 1) history.back(); else go('#/home');
        return;

      case 'add-expense': openExpenseSheet({}); return;
      case 'add-expense-in': openExpenseSheet({ groupId: id }); return;
      case 'edit-expense': openExpenseSheet({ expenseId: id }); return;

      case 'new-group': openGroupSheet('group'); return;
      case 'add-friend': openGroupSheet('friend'); return;

      case 'group-settings': go('#/group/' + id + '/settings'); return;
      case 'charts': go('#/charts/' + id); return;
      case 'group': go('#/group/' + id); return;
      case 'expense': go('#/expense/' + id); return;

      case 'delete-expense':
        confirmSheet({
          title: 'Delete this expense?',
          message: 'Balances will be recalculated. You can undo right after.',
          confirmLabel: 'Delete', danger: true,
        }).then(ok => { if (ok) deleteExpense(id); });
        return;

      case 'delete-group':
        confirmSheet({
          title: 'Delete this group?',
          message: 'The group and all of its expenses, payments and comments will be removed from this device.',
          confirmLabel: 'Delete group', danger: true,
        }).then(ok => {
          if (!ok) return;
          state.groups = state.groups.filter(g => g.id !== id);
          state.expenses = state.expenses.filter(x => x.groupId !== id);
          state.payments = state.payments.filter(x => x.groupId !== id);
          state.comments = state.comments.filter(c => {
            const ex = state.expenses.find(x => x.id === c.expenseId);
            return !!ex;
          });
          state.recurring = state.recurring.filter(r => r.groupId !== id);
          commit();
          showToast('Group deleted');
          go('#/groups');
        });
        return;

      case 'delete-friend':
        confirmSheet({
          title: 'Remove this friend?',
          message: 'Their shared expense history will be removed from this device.',
          confirmLabel: 'Remove', danger: true,
        }).then(ok => {
          if (!ok) return;
          state.groups = state.groups.filter(g => g.id !== id);
          state.expenses = state.expenses.filter(x => x.groupId !== id);
          state.payments = state.payments.filter(x => x.groupId !== id);
          commit();
          showToast('Friend removed');
          go('#/friends');
        });
        return;

      case 'remove-member': {
        const g = group(id);
        if (!g) return;
        g.members = g.members.filter(m => m !== t.dataset.uid);
        touch(g);
        commit();
        showToast('Member removed');
        return;
      }

      case 'settle-with':
        openSettleSheet({ groupId: id, with: t.dataset.with, amount: parseInt(t.dataset.amount, 10) });
        return;
      case 'settle-dir': ui.settleDraft.dir = t.dataset.dir; replaceSheetBody(settleHtml()); return;
      case 'settle-method': ui.settleDraft.method = t.dataset.method; replaceSheetBody(settleHtml()); return;
      case 'save-payment': {
        const r = recordPaymentFromDraft();
        if (!r.ok) showToast(r.error); else closeSheet();
        return;
      }

      case 'pick-category': openCategorySheet(); return;
      case 'pick-category-go':
        ui.draft.categoryId = id;
        closeSheet();
        replaceTopBody(expenseFormHtml());
        return;
      case 'pick-payer': openPayerSheet(); return;
      case 'pick-payer-go':
        ui.draft.paidBy = id;
        closeSheet();
        replaceTopBody(expenseFormHtml());
        return;

      case 'open-split': openSplitSheet(); return;
      case 'split-method': {
        const d = ui.draft;
        d.splitMethod = t.dataset.method;
        // re-seed value inputs for the new method, keeping participants on
        d.participants.forEach(p => { p.value = defaultSplitValue(d.splitMethod); });
        replaceSheetBody(splitEditorHtml());
        return;
      }
      case 'split-done':
        closeSheet();
        replaceTopBody(expenseFormHtml());
        return;

      case 'save-expense': {
        const r = saveExpenseFromDraft();
        if (!r.ok) showToast(r.error); else closeSheet();
        return;
      }

      case 'save-group': {
        const r = saveGroupFromDraft();
        if (!r.ok) showToast(r.error);
        return;
      }
      case 'save-members': {
        const r = saveMembersFromDraft();
        if (r && r.ok) closeSheet();
        return;
      }
      case 'save-profile': saveProfileFromDraft(); closeSheet(); return;
      case 'save-recurring': {
        const r = saveRecurringFromDraft();
        if (!r.ok) showToast(r.error); else closeSheet();
        return;
      }

      case 'pick-emoji': {
        const g = group(id);
        if (g) { g.emoji = t.dataset.emoji; touch(g); commit(); }
        return;
      }
      case 'pick-group-emoji':
        ui.groupDraft.emoji = t.dataset.emoji;
        replaceSheetBody(groupFormHtml());
        return;
      case 'pick-color':
        ui.profileDraft.color = t.dataset.color;
        replaceSheetBody(profileHtml());
        return;
      case 'remove-photo':
        ui.profileDraft.photo = '';
        replaceSheetBody(profileHtml());
        return;

      case 'add-member': openMemberSheet(id); return;
      case 'add-new-person': {
        const nameEl = document.querySelector('[data-field="new-person-name"]');
        const emailEl = document.querySelector('[data-field="new-person-email"]');
        const pname = (nameEl && nameEl.value ? nameEl.value : '').trim();
        const pemail = (emailEl && emailEl.value ? emailEl.value : '').trim();
        if (!pname) { showToast('Enter a name'); return; }
        if (!pemail || !EMAIL_RE.test(pemail)) { showToast('Enter a valid email'); return; }
        const uid = upsertUser(pname, pemail);
        const g = ui.memberDraft ? group(ui.memberDraft.groupId) : null;
        if (g) {
          if (!g.members.includes(uid)) g.members.push(uid);
          touch(g);
          if (!ui.memberDraft.selected.includes(uid)) ui.memberDraft.selected.push(uid);
          commit();
          showToast(pname + ' added to ' + g.name);
          replaceTopBody(memberSheetHtml());
        } else if (ui.groupDraft) {
          if (!ui.groupDraft.members.includes(uid)) ui.groupDraft.members.push(uid);
          showToast(pname + ' will join the new group');
          replaceTopBody(groupFormHtml());
        }
        return;
      }

      case 'recurring-new': openRecurringSheet(id); return;
      case 'recurring-add': recurringAddNow(id); return;
      case 'recurring-del': {
        state.recurring = state.recurring.filter(r => r.id !== id);
        commit();
        showToast('Recurring expense removed');
        return;
      }

      case 'activity-filter': ui.activityFilter = t.dataset.filter; render(); return;
      case 'all-exp-group': ui.allExpFilter.groupId = id; render(); return;

      case 'sync-now':
        showToast('Syncing\u2026');
        if (state.sync.mode === 'github') {
          ghCheckVisibility(true);
          ghSync({ force: true }).then(r => {
            showToast(r.ok ? (r.adopted ? 'Merged from the repo' : r.readOnly ? 'Repo is up to date (read-only)' : 'Repo is up to date') : 'Sync failed: ' + r.error);
          });
        } else {
          syncPull({ force: true }).then(r => {
            showToast(r.ok ? (r.adopted ? 'Synced from cloud' : r.deferred ? 'Cloud is newer \u2014 will apply shortly' : 'Cloud is up to date') : 'Sync failed: ' + r.error);
          });
        }
        return;
      case 'copy-share-link':
        copyText(shareLink(), 'Share link copied \u2014 send it to your friends');
        return;
      case 'export-csv': exportCsv(); return;
      case 'export-json':
        downloadJson(backupObject(), 'splitwise-backup.json');
        showToast('Backup exported');
        return;

      case 'reset-demo':
        confirmSheet({
          title: 'Reset demo data?',
          message: 'Everything you added on this device is replaced by the original sample data.',
          confirmLabel: 'Reset', danger: true,
        }).then(ok => {
          if (!ok) return;
          const meRec = me();
          const session = state.session;
          seedDemo();                 // replaces state wholesale...
          adoptDemoAsMe(state.meId);  // ...so restore our identity afterwards
          state.users[state.meId] = meRec;
          state.session = session;
          commit();
          applyTheme();
          go('#/home');
          showToast('Demo data restored');
        });
        return;

      case 'logout':
        state.session = null;
        commit();
        showToast('Exited \u2014 your data is still here');
        return;

      case 'toggle-theme':
        state.settings.theme = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme();
        render();
        return;
      case 'set-theme':
        state.settings.theme = t.dataset.theme;
        applyTheme();
        render();
        return;

      case 'pro-upsell': openProSheet(); return;
      case 'edit-profile': openProfileSheet(); return;

      case 'sheet-close': closeSheet(); return;
      case 'confirm-yes':
        if (confirmResolver) { confirmResolver(true); confirmResolver = null; }
        closeSheet();
        return;
      case 'confirm-no':
        if (confirmResolver) { confirmResolver(false); confirmResolver = null; }
        closeSheet();
        return;

      case 'enter-app': enterApp(t.dataset.mode || 'demo'); return;

      default: return;
    }
  });

  // refresh the body of the sheet currently on top of the stack
  function replaceTopBody(html) {
    const top = ui.sheets[ui.sheets.length - 1];
    if (top) { top.bodyHtml = html; renderSheetRoot(); }
  }

  /* ---------------- text inputs (live draft binding) ---------------- */

  let searchTimer = null;
  document.addEventListener('input', e => {
    const el = e.target;
    const f = el.dataset ? el.dataset.field : null;

    if (f === 'draft-description' && ui.draft) { ui.draft.description = el.value; return; }
    if (f === 'draft-amount' && ui.draft) { ui.draft.amountCents = C.toCents(el.value); return; }
    if (f === 'draft-notes' && ui.draft) { ui.draft.notes = el.value; return; }
    if (f === 'settle-amount' && ui.settleDraft) { ui.settleDraft.amountCents = C.toCents(el.value); return; }
    if (f === 'settle-note' && ui.settleDraft) { ui.settleDraft.note = el.value; return; }
    if (f === 'group-name' && ui.groupDraft) { ui.groupDraft.name = el.value; return; }
    if (f === 'friend-name' && ui.groupDraft) { ui.groupDraft.name = el.value; return; }
    if (f === 'friend-email' && ui.groupDraft) { ui.groupDraft.email = el.value; return; }
    if (f === 'profile-name' && ui.profileDraft) { ui.profileDraft.name = el.value; return; }
    if (f === 'profile-email' && ui.profileDraft) { ui.profileDraft.email = el.value; return; }
    if (f === 'rec-description' && ui.recurringDraft) { ui.recurringDraft.description = el.value; return; }
    if (f === 'rec-amount' && ui.recurringDraft) { ui.recurringDraft.amountCents = C.toCents(el.value); return; }

    if (f === 'all-exp-q') {
      clearTimeout(searchTimer);
      const caret = el.selectionStart;
      searchTimer = setTimeout(() => {
        ui.allExpFilter.q = el.value;
        render();
        const again = document.querySelector('[data-field="all-exp-q"]');
        if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (err) {} }
      }, 260);
      return;
    }

    if (el.dataset && el.dataset.partValue && ui.draft) {
      const uid = el.dataset.partValue;
      const p = ui.draft.participants.find(x => x.userId === uid);
      if (p) p.value = el.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        replaceSheetBody(splitEditorHtml());
        const again = document.querySelector('[data-part-value="' + uid + '"]');
        if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (err) {} }
      }, 420);
      return;
    }
  });

  /* ---------------- selects, checkboxes, dates, files ---------------- */

  document.addEventListener('change', e => {
    const el = e.target;
    const f = el.dataset ? el.dataset.field : null;

    if (f === 'draft-group' && ui.draft) {
      const g = group(el.value);
      if (g) {
        ui.draft.groupId = g.id;
        const prev = ui.draft.participants;
        ui.draft.participants = g.members.map(m => {
          const old = prev.find(x => x.userId === m);
          return { userId: m, on: old ? old.on : (m === state.meId), value: old ? old.value : defaultSplitValue(ui.draft.splitMethod) };
        });
        if (!g.members.includes(ui.draft.paidBy)) ui.draft.paidBy = state.meId;
      }
      replaceTopBody(expenseFormHtml());
      return;
    }
    if (f === 'draft-date' && ui.draft) { ui.draft.date = el.value; replaceTopBody(expenseFormHtml()); return; }

    if (f === 'sync-mode') {
      state.sync.mode = el.value === 'rest' || el.value === 'github' ? el.value : 'local';
      commit();
      return;
    }
    if (f === 'sync-room') {
      state.sync.room = el.value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      save();
      return;
    }
    if (f === 'default-currency') { state.settings.defaultCurrency = el.value; commit(); return; }
    if (f === 'group-currency' && el.dataset.id) {
      const g = group(el.dataset.id);
      if (g) { g.currency = el.value; touch(g); commit(); }
      return;
    }
    if (f === 'rec-category' && ui.recurringDraft) { ui.recurringDraft.categoryId = el.value; return; }
    if (f === 'rec-cadence' && ui.recurringDraft) { ui.recurringDraft.cadence = el.value; return; }
    if (f === 'rec-payer' && ui.recurringDraft) { ui.recurringDraft.paidBy = el.value; return; }
    if (f === 'rec-next' && ui.recurringDraft) { ui.recurringDraft.nextDate = el.value; return; }
    if (f === 'settle-date' && ui.settleDraft) { ui.settleDraft.date = el.value; return; }

    if (el.dataset && el.dataset.partOn && ui.draft) {
      const uid = el.dataset.partOn;
      const p = ui.draft.participants.find(x => x.userId === uid);
      if (p) {
        p.on = el.checked;
        if (p.on && !p.value) p.value = defaultSplitValue(ui.draft.splitMethod);
      }
      replaceSheetBody(splitEditorHtml());
      return;
    }

    if (el.dataset && el.dataset.member) {
      const uid = el.dataset.member;
      if (ui.memberDraft) {
        if (el.checked) { if (!ui.memberDraft.selected.includes(uid)) ui.memberDraft.selected.push(uid); }
        else ui.memberDraft.selected = ui.memberDraft.selected.filter(x => x !== uid);
      } else if (ui.groupDraft) {
        if (el.checked) { if (!ui.groupDraft.members.includes(uid)) ui.groupDraft.members.push(uid); }
        else ui.groupDraft.members = ui.groupDraft.members.filter(x => x !== uid);
      }
      return;
    }

    if (el.dataset && el.dataset.notif) {
      state.settings.notifications[el.dataset.notif] = el.checked;
      save();
      return;
    }
    if (el.dataset && el.dataset.simplify) {
      const g = group(el.dataset.simplify);
      if (g) { g.simplifyDebts = el.checked; touch(g); commit(); }
      return;
    }

    // receipt / photo uploads
    if (f === 'draft-receipt' && el.files && el.files[0]) readImage(el.files[0], dataUrl => {
      if (ui.draft) ui.draft.receipt = dataUrl;
      replaceTopBody(expenseFormHtml());
      showToast('Receipt attached');
    });
    if (f === 'profile-photo' && el.files && el.files[0]) readImage(el.files[0], dataUrl => {
      if (ui.profileDraft) ui.profileDraft.photo = dataUrl;
      replaceSheetBody(profileHtml());
    });
    if (f === 'import-json' && el.files && el.files[0]) {
      const file = el.files[0];
      if (file.size > 8 * 1024 * 1024) { showToast('Backup too large (max 8 MB)'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        let parsed = null;
        try { parsed = JSON.parse(reader.result); } catch (e) { showToast('Not a valid JSON file'); return; }
        const r = importBackup(parsed);
        showToast(r.ok ? 'Backup restored' : r.error);
      };
      reader.onerror = () => showToast('Could not read that file');
      reader.readAsText(file);
    }
  });

  function readImage(file, cb) {
    // with cloud sync the whole ledger (receipts included) is pushed on every
    // change, so keep attachments small enough for the endpoint's limits
    const limit = syncEnabled() ? 150 * 1024 : 1.5 * 1024 * 1024;
    if (file.size > limit) {
      showToast(syncEnabled()
        ? 'Image too large for cloud sync (max 150 KB)'
        : 'Image too large (max 1.5 MB)');
      return;
    }
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.onerror = () => showToast('Could not read that image');
    r.readAsDataURL(file);
  }

  /* ---------------- form submits ---------------- */

  document.addEventListener('submit', e => {
    const form = e.target;
    const kind = form.dataset ? form.dataset.form : null;
    if (!kind) return;
    e.preventDefault();

    if (kind === 'name') {
      enterApp('demo');
      return;
    }

    if (kind === 'sync') {
      const g = n => { const x = form.querySelector('[data-field="' + n + '"]'); return x ? x.value : ''; };
      const mode = g('sync-mode') === 'rest' ? 'rest' : 'local';
      const url = g('sync-url').trim();
      if (mode === 'rest' && !/^https?:\/\//.test(url)) { showToast('Endpoint must start with http(s)://'); return; }
      saveSyncSettings({
        mode, url, room: g('sync-room'),
        headerName: g('sync-header-name'), headerValue: g('sync-header-value'),
        ghRepo: g('gh-repo'), ghPath: g('gh-path'), ghBranch: g('gh-branch'), ghToken: g('gh-token'),
        ghPass: g('gh-pass'),
      });
      if (mode === 'github') {
        showToast('Settings saved \u2014 testing the repo\u2026');
        ghCheckVisibility(true);
        ghSync({ force: true }).then(r => {
          showToast(r.ok
            ? (r.adopted ? 'Merged from the repo' : r.readOnly ? 'Repo is up to date (read-only)' : 'Repo is up to date')
            : 'Sync failed: ' + r.error);
        });
      } else if (mode === 'rest') {
        showToast('Settings saved \u2014 testing endpoint\u2026');
        syncPull().then(r => {
          showToast(r.ok ? (r.adopted ? 'Synced from cloud' : 'Cloud is up to date') : 'Sync failed: ' + r.error);
        });
      } else {
        showToast('Sync settings saved');
      }
      return;
    }

    if (kind === 'comment') {
      const input = form.querySelector('[data-field="comment-text"]');
      const text = (input.value || '').trim();
      if (!text) return;
      state.comments.push({
        id: C.id('c'),
        expenseId: form.dataset.id,
        userId: state.meId,
        text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      commit();
      showToast('Comment posted');
      return;
    }

    if (kind === 'group-basic') {
      const g = group(form.dataset.id);
      if (!g) return;
      const nameEl = form.querySelector('[data-field="group-name"]');
      if (nameEl && g.kind === 'group') {
        const name = nameEl.value.trim();
        if (name) g.name = name;
      }
      touch(g);
      commit();
      showToast('Group updated');
      return;
    }

  });

  /* ================================================================== *
   * Boot
   * ================================================================== */

  function currentTheme() {
    const t = state.settings.theme;
    if (t === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', currentTheme() === 'dark' ? '#202224' : '#1CC29F');
  }

  function init() {
    load();
    applySharedLink();
    applyTheme();
    window.addEventListener('hashchange', render);
    window.addEventListener('popstate', render);
    let wasDesktop = isDesktop();
    window.addEventListener('resize', () => {
      if (isDesktop() !== wasDesktop) { wasDesktop = isDesktop(); render(); }
    });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', () => { if (state.settings.theme === 'system') { applyTheme(); render(); } });
    }
    render();
    // remote sync on startup so a new phone/browser gets the ledger
    if (syncEnabled()) {
      setTimeout(() => {
        remoteSync({ force: true }).then(r => { if (!r.ok && r.error) showToast('Sync unavailable: ' + r.error); });
      }, 400);
      // light polling so a friend's new expense shows up without a refresh
      setInterval(() => {
        if (syncEnabled() && document.visibilityState !== 'hidden') remoteSync();
      }, syncPollMs());
    }
  }

  // a shared link pre-configures sync on first open
  function applySharedLink() {
    const gm = /[#&]ghrepo=([^&]+)/.exec(location.hash);
    if (gm) {
      const repo = decodeURIComponent(gm[1]);
      const pm = /[#&]ghpath=([^&]+)/.exec(location.hash);
      const bm = /[#&]ghbranch=([^&]+)/.exec(location.hash);
      if (/^[^/\s]+\/[^/\s]+$/.test(repo)) {
        state.sync.mode = 'github';
        state.sync.ghRepo = repo;
        if (pm) state.sync.ghPath = decodeURIComponent(pm[1]).replace(/^\/+/, '');
        if (bm) state.sync.ghBranch = decodeURIComponent(bm[1]);
        commit();
        showToast('Repo sync configured \u2014 paste your token in Account \u2192 Data sync');
      }
      cleanHash();
      return;
    }
    const m = /[#&]endpoint=([^&]+)/.exec(location.hash);
    if (!m) return;
    const url = decodeURIComponent(m[1]).replace(/\/+$/, '');
    const rm = /[#&]room=([^&]+)/.exec(location.hash);
    const room = rm ? decodeURIComponent(rm[1]).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
    if (/^https?:\/\//.test(url)) {
      state.sync.mode = 'rest';
      state.sync.url = url;
      if (room) state.sync.room = room;
      commit();
      showToast('Cloud sync configured \u2014 room "' + syncRoom() + '"');
    }
    cleanHash();
  }

  function cleanHash() {
    try {
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#/home');
      else location.hash = '#/home';
    } catch (e) { location.hash = '#/home'; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // exposed for smoke tests / console debugging
  window.SplitClone = {
    getState: () => state,
    ui,
    render,
    go,
    commit,
    openExpenseSheet,
    openSettleSheet,
    openGroupSheet,
    openMemberSheet,
    openSplitSheet,
    openProfileSheet,
    openRecurringSheet,
    saveExpenseFromDraft,
    recordPaymentFromDraft,
    saveGroupFromDraft,
    saveMembersFromDraft,
    saveProfileFromDraft,
    saveRecurringFromDraft,
    deleteExpense,
    recurringAddNow,
    exportCsv,
    backupObject,
    importBackup,
    syncPush,
    syncPull,
    syncPayload,
    saveSyncSettings,
    syncStatusHtml,
    shareLink,
    syncLog,
    mergeBackup,
    upsertUser,
    identityId,
    ghSync,
    ghGet,
    ghPut,
    parseJsonl,
    toJsonl,
    ghConfigured,
    ghCheckVisibility,
    ghEncryptJsonl,
    ghDecryptBlob,
    isEncryptedBlob,
    applySharedLink,
    groupBalances: gid => C.groupBalances(state, gid),
    simplifyDebts: bal => C.simplifyDebts(bal),
    activityEntries,
    expensesToCsv: () => C.expensesToCsv(state, state.meId),
    seedDemo,
  };
})();
