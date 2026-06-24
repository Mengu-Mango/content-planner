const BUCKET = 'menu-letters-moodboards';
const STORAGE_KEY = 'menu_letters_content_studio_v1';
const CONFIG_KEY = 'menu_letters_supabase_config_v1';
const CODE_CONFIG = window.MENU_LETTERS_SUPABASE_CONFIG || {};

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const BUSINESS_CONTEXT = `Menu Letters ist ein monatlicher Snail Mail Club. Ein Brief per Post verbindet Design, Food, Ästhetik, kreative Inspiration und ein vegetarisches Rezept. Jede Ausgabe enthält ein wechselndes Thema, eine kunstvoll gestaltete Postkarte, eine Rezeptkarte und einen persönlichen Brief. Zielgruppe: Menschen, die kreative Pausen, Food, Design, echte analoge Dinge und Slow Living lieben. Wichtige Infos: Anmeldungen bis zum 28. eines Monats, Versand immer um den 15., Abo jederzeit kündbar.`;

const REFERENCE_VIDEOS = [
  {
    title: 'Precious Post Launch Reel',
    platform: 'Instagram',
    url: 'https://www.instagram.com/reel/DZeb40FRaDB/',
    note: 'Launch/Founderstory für einen Snail-Mail-Club. Analysiere Hook, persönliche Nervosität und klare Community-Einladung.'
  },
  {
    title: 'Comment “CLUB” Mail Club CTA',
    platform: 'Instagram',
    url: 'https://www.instagram.com/reel/DXaQ1SbDt-D/',
    note: 'Direkter Kommentar-CTA. Gut als Inspiration für Warteliste, DM-Automation oder begrenzte Plätze.'
  },
  {
    title: 'February Mail Club Handmade Process',
    platform: 'Instagram',
    url: 'https://www.instagram.com/reel/DUOXEQVDptP/',
    note: 'Handmade/Behind-the-scenes-Fokus. Perfekt, um Wertigkeit und analoge Details sichtbar zu machen.'
  }
];

let supabaseClient = null;
let currentUser = null;
let activeView = 'dashboard';
let activeTodoFilter = 'all';
let calendarDate = new Date();
let selectedCalendarDate = isoDate(new Date());
let editingEventId = null;
let activeMonthKey = monthKey(new Date());
let selectedAssetId = null;

let state = {
  todos: [],
  events: [],
  ideas: [],
  moodboards: {},
  assets: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateDE(value) {
  if (!value) return 'ohne Datum';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseIsoDate(value));
}

function formatLongDateDE(value) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(parseIsoDate(value));
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function fillMonthYearSelects(monthSelect, yearSelect, selectedDate = calendarDate) {
  if (!monthSelect || !yearSelect) return;
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  monthSelect.innerHTML = MONTHS.map((name, index) => `<option value="${index}" ${index === month ? 'selected' : ''}>${name}</option>`).join('');
  const years = [];
  for (let y = year - 3; y <= year + 5; y++) years.push(y);
  yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');
}

function setupDateDropdowns(daySelector, monthSelector, yearSelector, value = isoDate(new Date())) {
  const daySelect = $(daySelector);
  const monthSelect = $(monthSelector);
  const yearSelect = $(yearSelector);
  if (!daySelect || !monthSelect || !yearSelect) return;

  const selected = parseIsoDate(value);
  const selectedYear = selected.getFullYear();
  const selectedMonth = selected.getMonth();
  const selectedDay = selected.getDate();

  monthSelect.innerHTML = MONTHS.map((name, index) => `<option value="${index + 1}" ${index === selectedMonth ? 'selected' : ''}>${String(index + 1).padStart(2, '0')} · ${name}</option>`).join('');

  const years = [];
  for (let y = selectedYear - 2; y <= selectedYear + 5; y++) years.push(y);
  yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');

  const updateDays = () => {
    const year = Number(yearSelect.value) || selectedYear;
    const monthIndex = (Number(monthSelect.value) || 1) - 1;
    const currentDay = Number(daySelect.value) || selectedDay;
    const maxDay = daysInMonth(year, monthIndex);
    const safeDay = Math.min(currentDay, maxDay);
    daySelect.innerHTML = Array.from({ length: maxDay }, (_, index) => {
      const day = index + 1;
      return `<option value="${day}" ${day === safeDay ? 'selected' : ''}>${String(day).padStart(2, '0')}</option>`;
    }).join('');
  };

  updateDays();
  daySelect.value = String(Math.min(selectedDay, daysInMonth(selectedYear, selectedMonth)));

  if (!daySelect.dataset.bound) {
    monthSelect.addEventListener('change', updateDays);
    yearSelect.addEventListener('change', updateDays);
    daySelect.dataset.bound = 'true';
  }
}

function getDateFromDropdowns(daySelector, monthSelector, yearSelector) {
  const day = Number($(daySelector)?.value || 1);
  const month = Number($(monthSelector)?.value || 1);
  const year = Number($(yearSelector)?.value || new Date().getFullYear());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function loadLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = { ...state, ...JSON.parse(raw) }; } catch (error) { console.warn(error); }
  }
  seedInitialData();
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedInitialData() {
  if (!state.todos.length && !state.events.length && !state.ideas.length) {
    const today = new Date();
    const fifteenth = new Date(today.getFullYear(), today.getMonth(), 15);
    const deadline = new Date(today.getFullYear(), today.getMonth(), 28);
    state.todos = [
      { id: uid('todo'), title: 'Monatsthema definieren', due_date: isoDate(today), priority: 'high', status: 'open', notes: '' },
      { id: uid('todo'), title: 'Rezeptkarte fotografieren', due_date: isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)), priority: 'normal', status: 'open', notes: '' },
      { id: uid('todo'), title: 'Abo-Frist am 28. kommunizieren', due_date: isoDate(deadline), priority: 'high', status: 'open', notes: '' }
    ];
    state.events = [
      { id: uid('event'), title: 'Versand Menu Letters', date: isoDate(fifteenth), type: 'shipping', notes: 'Versand erfolgt immer um den 15.' },
      { id: uid('event'), title: 'Abo-Anmeldeschluss', date: isoDate(deadline), type: 'business', notes: 'Anmeldungen bis 23:59 Uhr.' }
    ];
    state.ideas = [
      generateContentIdeas({ theme: 'Sommermarkt', recipe: 'Blaubeer-Zitronen-Muffins', effort: '30 Minuten', platform: 'Instagram Reel', goal: 'Community aufbauen', note: '' })[0]
    ];
  }
  const year = new Date().getFullYear();
  MONTHS.forEach((name, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    if (!state.moodboards[key]) {
      state.moodboards[key] = { month_key: key, title: name, theme: '', recipe: '', notes: '', cover_url: '', cover_path: '' };
    }
  });
  saveLocalState();
}

function loadConfig() {
  const codeUrl = (CODE_CONFIG.url || '').trim();
  const codeAnon = (CODE_CONFIG.anonKey || CODE_CONFIG.anon || '').trim();
  if (codeUrl && codeAnon) return { url: codeUrl, anon: codeAnon };

  // Fallback für ältere Versionen: Falls du die Daten früher im Settings-Bereich gespeichert hast.
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return { url: '', anon: '' };
  try { return JSON.parse(raw); } catch { return { url: '', anon: '' }; }
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

async function initSupabase() {
  const config = loadConfig();
  syncConfigFields(config);

  if (!config.url || !config.anon) {
    supabaseClient = null;
    currentUser = null;
    updateAuthStatus('Supabase ist noch nicht in config.js eingetragen. Bitte deine URL und deinen Anon/Public Key in config.js einfügen.', 'info');
    return;
  }

  if (!window.supabase) {
    supabaseClient = null;
    currentUser = null;
    updateAuthStatus('Supabase konnte nicht geladen werden. Bitte über Live Server öffnen und Internetverbindung prüfen.', 'error');
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anon);
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    currentUser = null;
    updateAuthStatus(error.message, 'error');
    return;
  }
  currentUser = data?.session?.user || null;
  updateAuthStatus();
  if (currentUser) await loadRemoteState();
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    updateAuthStatus();
    if (currentUser) await loadRemoteState();
    renderAll();
  });
}

function syncConfigFields(config) {
  const pairs = [
    ['#supabaseUrl', config.url || ''],
    ['#supabaseAnon', config.anon || ''],
    ['#loginSupabaseUrl', config.url || ''],
    ['#loginSupabaseAnon', config.anon || '']
  ];
  pairs.forEach(([selector, value]) => {
    const input = $(selector);
    if (input) input.value = value;
  });
}

function updateSyncStatus(label) {
  const el = $('#syncStatus');
  if (el) el.textContent = label;
}

function setAuthMessage(message, tone = 'info') {
  ['#authStatus', '#loginStatus'].forEach(selector => {
    const el = $(selector);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('error', 'success');
    if (tone === 'error') el.classList.add('error');
    if (tone === 'success') el.classList.add('success');
  });
}

function updateAuthGate() {
  document.body.classList.toggle('app-authenticated', Boolean(currentUser));
}

function updateAuthStatus(message, tone = 'info') {
  if (!supabaseClient) {
    updateSyncStatus('Login erforderlich');
    setAuthMessage(message || 'Nicht verbunden. Supabase ist noch nicht in config.js eingetragen.', tone);
    updateAuthGate();
    return;
  }
  if (currentUser) {
    updateSyncStatus('Supabase Sync');
    setAuthMessage(`Eingeloggt als ${currentUser.email}`, 'success');
  } else {
    updateSyncStatus('Login erforderlich');
    setAuthMessage(message || 'Supabase verbunden. Bitte einloggen.', tone);
  }
  updateAuthGate();
}

async function connectSupabaseFrom(source = 'settings') {
  const urlInput = source === 'login' ? $('#loginSupabaseUrl') : $('#supabaseUrl');
  const anonInput = source === 'login' ? $('#loginSupabaseAnon') : $('#supabaseAnon');
  const url = urlInput?.value.trim() || '';
  const anon = anonInput?.value.trim() || '';
  if (!url || !anon) {
    updateAuthStatus('Bitte Supabase URL und Anon Key eintragen.', 'error');
    return;
  }
  saveConfig({ url, anon });
  await initSupabase();
  renderAll();
}

function getAuthCredentials(source = 'settings') {
  const email = (source === 'login' ? $('#loginAuthEmail') : $('#authEmail'))?.value.trim() || '';
  const password = (source === 'login' ? $('#loginAuthPassword') : $('#authPassword'))?.value || '';
  return { email, password };
}

async function signUpWithEmail(source = 'settings') {
  if (!supabaseClient) return updateAuthStatus('Supabase ist noch nicht in config.js eingetragen.', 'error');
  const { email, password } = getAuthCredentials(source);
  if (!email || !password) return updateAuthStatus('Bitte E-Mail und Passwort eingeben.', 'error');
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return updateAuthStatus(error.message, 'error');
  updateAuthStatus('Account erstellt. Du kannst dich jetzt einloggen.', 'success');
}

async function signInWithEmail(source = 'settings') {
  if (!supabaseClient) return updateAuthStatus('Supabase ist noch nicht in config.js eingetragen.', 'error');
  const { email, password } = getAuthCredentials(source);
  if (!email || !password) return updateAuthStatus('Bitte E-Mail und Passwort eingeben.', 'error');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return updateAuthStatus(error.message, 'error');
  updateAuthStatus('Eingeloggt.', 'success');
}

async function loadRemoteState() {
  if (!supabaseClient || !currentUser) return;

  const [todosRes, eventsRes, ideasRes, moodRes, assetsRes] = await Promise.all([
    supabaseClient.from('ml_todos').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('ml_events').select('*').order('date', { ascending: true }),
    supabaseClient.from('ml_content_ideas').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('ml_moodboards').select('*'),
    supabaseClient.from('ml_moodboard_assets').select('*').order('z', { ascending: true })
  ]);

  const remoteErrors = [todosRes, eventsRes, ideasRes, moodRes, assetsRes].filter(result => result.error).map(result => result.error.message);
  if (remoteErrors.length) {
    console.error('Supabase Ladefehler:', remoteErrors);
    setAuthMessage(`Supabase Ladefehler: ${remoteErrors[0]}`, 'error');
  }

  if (!todosRes.error && todosRes.data) state.todos = todosRes.data;
  if (!eventsRes.error && eventsRes.data) state.events = eventsRes.data;
  if (!ideasRes.error && ideasRes.data) state.ideas = ideasRes.data.map(dbIdeaToAppIdea);
  if (!moodRes.error && moodRes.data) {
    for (const board of moodRes.data) {
      state.moodboards[board.month_key] = {
        month_key: board.month_key,
        title: board.title || MONTHS[Number(board.month_key.slice(5)) - 1],
        theme: board.theme || '',
        recipe: board.recipe || '',
        notes: board.notes || '',
        cover_path: board.cover_path || '',
        cover_url: board.cover_path ? await signedUrl(board.cover_path) : (board.cover_url || '')
      };
    }
  }
  if (!assetsRes.error && assetsRes.data) {
    state.assets = await Promise.all(assetsRes.data.map(async asset => ({
      id: asset.id,
      month_key: asset.month_key,
      path: asset.storage_path,
      url: await signedUrl(asset.storage_path),
      x: asset.x,
      y: asset.y,
      width: asset.width,
      rotation: asset.rotation,
      z: asset.z
    })));
  }
  saveLocalState();
}

function dbIdeaToAppIdea(row) {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    effort: row.effort,
    goal: row.goal,
    theme: row.theme,
    hook: row.hook,
    scenes: row.scenes || [],
    voiceover: row.voiceover,
    script: row.script,
    caption: row.caption,
    hashtags: row.hashtags,
    status: row.status || 'idea',
    created_at: row.created_at
  };
}

function appIdeaToDbIdea(idea) {
  return {
    id: idea.id,
    title: idea.title,
    platform: idea.platform,
    effort: idea.effort,
    goal: idea.goal,
    theme: idea.theme,
    hook: idea.hook,
    scenes: idea.scenes,
    voiceover: idea.voiceover,
    script: idea.script || '',
    caption: idea.caption,
    hashtags: idea.hashtags,
    status: idea.status || 'idea'
  };
}

async function signedUrl(path) {
  if (!supabaseClient || !path) return '';
  const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return '';
  return data.signedUrl;
}

async function upsertRemote(table, item) {
  saveLocalState();
  if (!supabaseClient || !currentUser) return;

  // Wichtig für echte Synchronisierung über mehrere Geräte:
  // Jede Zeile bekommt explizit die Supabase User-ID.
  // Dadurch greifen die RLS-Regeln sauber und die Daten landen wirklich in Supabase.
  const payload = { ...item, user_id: currentUser.id };
  const { error } = await supabaseClient.from(table).upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('Supabase Sync Fehler:', table, error);
    updateSyncStatus('Sync Fehler');
    setAuthMessage(`Supabase Sync Fehler bei ${table}: ${error.message}`, 'error');
    return;
  }

  updateSyncStatus('Supabase Sync');
}

async function deleteRemote(table, id) {
  saveLocalState();
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from(table).delete().eq('id', id);
  if (error) console.error(error);
}

function setView(viewName) {
  activeView = viewName;
  $$('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  $$('.view').forEach(view => view.classList.remove('active'));
  $(`#${viewName}View`).classList.add('active');
  const titles = {
    dashboard: 'Content Studio', assistant: 'AI Assistant', todos: 'To-do Liste', calendar: 'Kalender', year: 'Jahresübersicht', moodboard: 'Moodboard Journal', settings: 'Settings'
  };
  $('#viewTitle').textContent = titles[viewName] || 'Menu Letters';
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderTodos();
  renderCalendar();
  renderYear();
  renderMoodMonthSelect();
  renderMoodboard();
  renderIdeas();
  renderReferences();
}

function renderDashboard() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  $('#statIdeas').textContent = state.ideas.length;
  $('#statTodos').textContent = state.todos.filter(t => t.status !== 'done').length;
  $('#statEvents').textContent = state.events.length;

  const dashboardTodos = $('#dashboardTodos');
  const openTodos = [...state.todos].filter(t => t.status !== 'done').sort((a,b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 5);
  dashboardTodos.innerHTML = openTodos.length ? openTodos.map(todo => `
    <div class="mini-item"><strong>${escapeHtml(todo.title)}</strong><span>${formatDateDE(todo.due_date)} · ${todo.priority}</span></div>
  `).join('') : '<div class="empty-small">Keine offenen To-dos. 🥳</div>';

  const dashboardIdeas = $('#dashboardIdeas');
  dashboardIdeas.innerHTML = state.ideas.slice(0, 5).map(idea => `
    <div class="mini-item"><strong>${escapeHtml(idea.title)}</strong><span>${escapeHtml(idea.platform || 'Content')} · ${escapeHtml(idea.effort || '')}</span></div>
  `).join('') || '<div class="empty-small">Noch keine Content-Ideen.</div>';
}

function renderTodos() {
  const list = $('#todoList');
  let todos = [...state.todos];
  if (activeTodoFilter === 'open') todos = todos.filter(t => t.status !== 'done');
  if (activeTodoFilter === 'done') todos = todos.filter(t => t.status === 'done');
  todos.sort((a,b) => (a.status === 'done') - (b.status === 'done') || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  list.innerHTML = todos.length ? todos.map(todo => `
    <div class="todo-item ${todo.status === 'done' ? 'done' : ''} priority-${todo.priority}" data-id="${todo.id}">
      <input class="todo-check" type="checkbox" ${todo.status === 'done' ? 'checked' : ''} aria-label="Erledigt" />
      <div>
        <strong contenteditable="true" class="todo-title">${escapeHtml(todo.title)}</strong>
        <span>${formatDateDE(todo.due_date)} · ${todo.priority}</span>
      </div>
      <div class="todo-actions">
        <button class="small-btn edit-date">Datum</button>
        <button class="small-btn danger delete-todo">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="empty-small">Noch keine Aufgaben angelegt.</div>';
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  $('#calendarTitle').textContent = `${MONTHS[month]} ${year}`;

  fillMonthYearSelects($('#calendarMonthSelect'), $('#calendarYearSelect'), calendarDate);
  setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);

  const grid = $('#calendarGrid');
  grid.innerHTML = '';

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const todayIso = isoDate(new Date());

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateIso = isoDate(date);
    const day = document.createElement('div');
    day.className = `calendar-day ${date.getMonth() !== month ? 'outside' : ''} ${dateIso === todayIso ? 'today' : ''} ${dateIso === selectedCalendarDate ? 'selected' : ''}`;
    day.dataset.date = dateIso;
    const dayEvents = state.events.filter(event => event.date === dateIso).sort((a, b) => a.title.localeCompare(b.title, 'de'));
    const dayTodos = state.todos.filter(todo => todo.due_date === dateIso);
    day.innerHTML = `
      <div class="day-number"><span>${date.getDate()}</span><button class="day-add" type="button" title="Eintrag hinzufügen">+</button></div>
      ${dayEvents.map(event => `<button class="event-chip ${event.type}" type="button" data-id="${event.id}">${escapeHtml(event.title)}</button>`).join('')}
      ${dayTodos.map(todo => `<button class="event-chip todo-chip" type="button" data-todo-id="${todo.id}">✓ ${escapeHtml(todo.title)}</button>`).join('')}
    `;
    grid.appendChild(day);
  }

  renderDayAgenda();
}

function renderDayAgenda() {
  const title = $('#selectedDayTitle');
  const agenda = $('#dayAgenda');
  if (!title || !agenda) return;
  title.textContent = formatLongDateDE(selectedCalendarDate);

  const dayEvents = state.events.filter(event => event.date === selectedCalendarDate).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const dayTodos = state.todos.filter(todo => todo.due_date === selectedCalendarDate);

  const eventList = dayEvents.length ? dayEvents.map(event => `
    <div class="agenda-item" data-id="${event.id}">
      <div>
        <span class="tag">${event.type}</span>
        <strong>${escapeHtml(event.title)}</strong>
        ${event.notes ? `<p>${escapeHtml(event.notes)}</p>` : ''}
      </div>
      <div class="todo-actions">
        <button class="small-btn edit-event" type="button">Bearbeiten</button>
        <button class="small-btn danger delete-event" type="button">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="empty-small">Keine Kalendereinträge für diesen Tag.</div>';

  const todoList = dayTodos.length ? dayTodos.map(todo => `
    <div class="agenda-item todo-agenda-item" data-todo-id="${todo.id}">
      <div>
        <span class="tag">To-do</span>
        <strong>${escapeHtml(todo.title)}</strong>
        <p>${todo.status === 'done' ? 'Erledigt' : 'Offen'} · ${todo.priority}</p>
      </div>
      <button class="small-btn toggle-agenda-todo" type="button">${todo.status === 'done' ? 'Wieder öffnen' : 'Erledigt'}</button>
    </div>
  `).join('') : '<div class="empty-small">Keine To-dos mit diesem Datum.</div>';

  agenda.innerHTML = `
    <div>
      <p class="eyebrow">Kalenderpunkte</p>
      <div class="agenda-list">${eventList}</div>
    </div>
    <div>
      <p class="eyebrow">Fällige To-dos</p>
      <div class="agenda-list">${todoList}</div>
    </div>
  `;
}

function openEventModal(eventId) {
  const item = state.events.find(event => event.id === eventId);
  if (!item) return;
  editingEventId = eventId;
  $('#editEventTitle').value = item.title || '';
  $('#editEventType').value = item.type || 'content';
  $('#editEventNotes').value = item.notes || '';
  setupDateDropdowns('#editEventDay', '#editEventMonth', '#editEventYear', item.date || selectedCalendarDate);
  $('#eventModal').classList.remove('hidden');
  $('#editEventTitle').focus();
}

function closeEventModal() {
  editingEventId = null;
  $('#eventModal')?.classList.add('hidden');
}

function renderYear() {
  const year = new Date().getFullYear();
  const grid = $('#yearGrid');
  grid.innerHTML = MONTHS.map((name, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const board = state.moodboards[key] || {};
    const cover = board.cover_url ? `<img src="${board.cover_url}" alt="${name} Titelbild">` : 'Titelbild hinzufügen';
    const noteCount = (board.notes || '').trim().length;
    return `
      <article class="month-card" data-key="${key}">
        <div class="month-cover">${cover}</div>
        <h4>${name}</h4>
        <p>${escapeHtml(board.theme || 'Noch kein Thema')}</p>
        <p>${noteCount ? 'Notizen vorhanden' : 'Moodboard öffnen'}</p>
      </article>
    `;
  }).join('');
}

function renderMoodMonthSelect() {
  const select = $('#moodMonthSelect');
  if (select.children.length) return;
  const year = new Date().getFullYear();
  select.innerHTML = MONTHS.map((name, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    return `<option value="${key}">${name} ${year}</option>`;
  }).join('');
  select.value = activeMonthKey;
}

function renderMoodboard() {
  const board = state.moodboards[activeMonthKey] || { title: activeMonthKey, theme: '', recipe: '', notes: '', cover_url: '' };
  $('#moodMonthSelect').value = activeMonthKey;
  $('#moodTitle').textContent = `${board.title || activeMonthKey} Moodboard`;
  $('#moodTheme').value = board.theme || '';
  $('#moodRecipe').value = board.recipe || '';
  $('#moodNotes').value = board.notes || '';
  $('#coverPreview').innerHTML = board.cover_url ? `<img src="${board.cover_url}" alt="Titelbild">` : 'Titelbild';
  renderAssets();
}

function renderAssets() {
  const canvas = $('#photoCanvas');
  const assets = state.assets.filter(asset => asset.month_key === activeMonthKey).sort((a,b) => (a.z || 0) - (b.z || 0));
  canvas.innerHTML = assets.map(asset => `
    <div class="photo-note ${selectedAssetId === asset.id ? 'selected' : ''}" data-id="${asset.id}" style="left:${asset.x}px;top:${asset.y}px;width:${asset.width}px;transform:rotate(${asset.rotation}deg);z-index:${asset.z || 1}">
      <img src="${asset.url}" alt="Moodboard Foto" draggable="false">
      <div class="photo-controls">
        <button data-action="smaller">−</button>
        <button data-action="bigger">+</button>
        <button data-action="rotate-left">↺</button>
        <button data-action="rotate-right">↻</button>
        <button data-action="delete">×</button>
      </div>
    </div>
  `).join('');
}

function renderIdeas() {
  const output = $('#ideaOutput');
  if (!state.ideas.length) {
    output.className = 'idea-output empty-state';
    output.innerHTML = '<p class="script-title">Erzähl mir dein Monats-Thema.</p><p>Dann bekommst du passende Reel-/TikTok-Ideen inklusive Hook, Szenen, Skript, Voice-over, Caption, Hashtags und To-do-Liste.</p>';
    return;
  }
  output.className = 'idea-output';
  output.innerHTML = state.ideas.map(idea => ideaCardHtml(idea)).join('');
}

function ideaCardHtml(idea) {
  return `
    <article class="idea-card" data-id="${idea.id}">
      <div class="idea-card-head">
        <span class="tag">${escapeHtml(idea.platform || 'Content')} · ${escapeHtml(idea.effort || '')}</span>
        <button class="small-btn save-idea">In To-dos übernehmen</button>
      </div>
      <h4>${escapeHtml(idea.title)}</h4>
      <p class="hook">Hook: ${escapeHtml(idea.hook)}</p>
      <div class="idea-columns">
        <div><strong>Szenen</strong><ul>${(idea.scenes || []).map(scene => `<li>${escapeHtml(scene)}</li>`).join('')}</ul></div>
        <div><strong>Voice-over</strong><p class="voiceover">${escapeHtml(idea.voiceover || '')}</p></div>
      </div>
      <details>
        <summary>Caption & Hashtags</summary>
        <p class="caption">${escapeHtml(idea.caption || '')}</p>
        <p class="hashtags">${escapeHtml(idea.hashtags || '')}</p>
      </details>
    </article>
  `;
}

function renderReferences() {
  $('#referenceVideos').innerHTML = REFERENCE_VIDEOS.map(video => `
    <article class="reference-card">
      <p class="eyebrow">${video.platform}</p>
      <h4>${escapeHtml(video.title)}</h4>
      <p>${escapeHtml(video.note)}</p>
      <a href="${video.url}" target="_blank" rel="noreferrer">Video öffnen →</a>
    </article>
  `).join('');
}

function generateContentIdeas({ theme, recipe, effort, platform, goal, note }) {
  const cleanTheme = theme || 'dein Monatsthema';
  const cleanRecipe = recipe || 'dein Rezept';
  const baseTags = '#menuletters #snailmailclub #snailmail #slowmoments #creativepause #foodanddesign #postkartenliebe #smallbusinessdeutschland #analogmoments #romanticizeyourlife';
  const quick = effort.includes('10');
  const premium = effort.includes('90');

  const ideas = [
    {
      id: uid('idea'),
      title: `POV: Dein ${cleanTheme}-Brief landet im Briefkasten`,
      platform, effort, goal, theme: cleanTheme,
      hook: `POV: Du öffnest deinen Briefkasten und findest keinen Spam, sondern einen kleinen kreativen Moment.`,
      scenes: quick
        ? ['Brief aus dem Briefkasten ziehen', 'kurzer Close-up vom Umschlag', 'Postkarte und Rezept auffächern', 'Endcard: Anmeldung bis 28.']
        : ['Leerer Briefkasten / Hand greift rein', 'Umschlag auf dem Tisch', 'langsames Öffnen mit Papiergeräusch', `Reveal: ${cleanTheme}`, `Rezeptkarte ${cleanRecipe}`, 'Persönlicher Brief, kurzer Satz lesbar', 'Endcard mit Frist + Versandinfo'],
      voiceover: `Manchmal braucht man gar nicht viel. Nur einen kleinen Moment, auf den man sich freuen kann. Der neue Menu Letters Brief dreht sich um ${cleanTheme} und bringt dir eine Postkarte, ein vegetarisches Rezept für ${cleanRecipe} und einen persönlichen Brief direkt nach Hause.`,
      script: `Zeige erst den Moment, dann das Produkt. Kein harter Verkauf am Anfang. CTA erst am Ende.`,
      caption: `Echte Post fühlt sich einfach anders an. 💌 Der neue Menu Letters Brief ist ein kleiner kreativer Moment für deinen Alltag — mit Monats-Thema, Postkarte, Rezeptkarte und persönlichem Brief. Anmeldung bis zum 28., Versand um den 15.`,
      hashtags: baseTags,
      status: 'idea',
      created_at: new Date().toISOString()
    },
    {
      id: uid('idea'),
      title: `Pack with me: ${cleanTheme} Edition`,
      platform, effort, goal, theme: cleanTheme,
      hook: `Ich packe heute die vielleicht gemütlichste Post des Monats.`,
      scenes: ['Tisch vorbereiten', 'Postkarten stapeln', 'Rezeptkarten sortieren', 'Brief falten', 'Umschlag schließen', 'kleiner Stapel fertiger Briefe'],
      voiceover: `Heute packe ich die ${cleanTheme}-Ausgabe von Menu Letters. Jeder Brief enthält eine gestaltete Postkarte, ein vegetarisches Rezept und einen persönlichen Gedanken. Ich liebe es, dass aus Papier, Food und Design ein kleiner Moment entsteht, der wirklich bei jemandem zu Hause ankommt.`,
      script: `Nutze viele Close-ups: Hände, Papierstruktur, Karte, Briefumschlag, ruhige Bewegungen.`,
      caption: `Pack with me 💌 Diesen Monat wird es ${cleanTheme.toLowerCase()} — mit ${cleanRecipe}, einer neuen Postkarte und einem Brief, der dich kurz aus dem Alltag holt.`,
      hashtags: `${baseTags} #packwithme #behindthescenes #smallbusinessreels`,
      status: 'idea',
      created_at: new Date().toISOString()
    },
    {
      id: uid('idea'),
      title: `Warum echte Post 2026 wieder besonders ist`,
      platform, effort, goal, theme: cleanTheme,
      hook: `In einer Welt voller schneller Nachrichten fühlt sich ein echter Brief fast rebellisch an.`,
      scenes: premium
        ? ['Schnelle Handy-Notification-Montage', 'Cut zu ruhigem Tisch mit Brief', 'Schreibender Stift', 'Rezeptkarte', 'Kaffee/Tee daneben', 'Brief wird gelesen', 'Abo-Detail als Overlay']
        : ['Handy weglegen', 'Brief öffnen', 'Postkarte zeigen', 'kurzer Text-Overlay: slow mail > fast scroll'],
      voiceover: `Wir scrollen jeden Tag durch so viele Inhalte, aber kaum etwas bleibt wirklich hängen. Genau deshalb liebe ich Snail Mail. Menu Letters ist ein monatlicher Brief, der dich daran erinnert, langsamer zu werden, etwas Schönes in der Hand zu halten und dir einen kreativen Moment zu nehmen.`,
      script: `Dieses Video ist kein reines Produktvideo, sondern eine Haltung. Es verkauft über Gefühl und Wiedererkennung.`,
      caption: `Slow mail in a fast world. 💌 Menu Letters ist für alle, die Design, Food und kleine kreative Pausen lieben.`,
      hashtags: `${baseTags} #slowliving #digitaldetox #founderstory`,
      status: 'idea',
      created_at: new Date().toISOString()
    },
    {
      id: uid('idea'),
      title: `Vom Rezept zur Postkarte: ${cleanRecipe}`,
      platform, effort, goal, theme: cleanTheme,
      hook: `So wird aus einem Rezept eine kleine Design-Ausgabe per Post.`,
      scenes: ['Zutaten-Flatlay', 'Back-/Kochmoment', 'fertiges Rezept', 'Design am Laptop/iPad', 'gedruckte Rezeptkarte', 'Karte im Brief'],
      voiceover: `Jede Menu Letters Ausgabe beginnt mit einem Gefühl. Diesmal wurde daraus ${cleanTheme} — und passend dazu ${cleanRecipe}. Ich teste das Rezept, gestalte daraus eine Karte und verschicke sie als Teil des monatlichen Briefs.`,
      script: `Sehr gut für Foodie-Zielgruppe: Erst appetitlich, dann Designprozess, dann Abo-Kontext.`,
      caption: `Food + Design + echte Post = Menu Letters. Diesen Monat mit ${cleanRecipe}. 🍰`,
      hashtags: `${baseTags} #vegetarischerezepte #rezeptkarte #fooddesign`,
      status: 'idea',
      created_at: new Date().toISOString()
    },
    {
      id: uid('idea'),
      title: `3 Gründe, warum du den ${cleanTheme}-Brief lieben wirst`,
      platform, effort, goal, theme: cleanTheme,
      hook: `Drei Gründe, warum dein zukünftiges Ich diesen Brief lieben wird.`,
      scenes: ['Textoverlay 1: echter Briefmoment', 'Textoverlay 2: neue Rezeptidee', 'Textoverlay 3: kleine kreative Pause', 'Abo-Frist anzeigen'],
      voiceover: `Erstens: Du bekommst etwas Echtes per Post. Zweitens: Du entdeckst jeden Monat ein vegetarisches Rezept. Drittens: Du schenkst dir selbst einen kleinen Moment, der nicht auf einem Bildschirm stattfindet.`,
      script: `Schnell, klar, speicherbar. Funktioniert auch als Carousel mit 5 Slides.`,
      caption: `Für dich gemacht, wenn du Food, Design und kleine kreative Pausen liebst. Anmeldung bis zum 28. möglich.`,
      hashtags: `${baseTags} #aboliebe #postkarten #creativebusiness`,
      status: 'idea',
      created_at: new Date().toISOString()
    }
  ];

  if (note) {
    ideas[0].voiceover += ` ${note}`;
  }
  return ideas;
}

async function tryAiAssistant(payload) {
  if (!supabaseClient || !currentUser) return null;
  try {
    const { data, error } = await supabaseClient.functions.invoke('menu-assistant', {
      body: { ...payload, businessContext: BUSINESS_CONTEXT }
    });
    if (error || !data?.ideas) return null;
    return data.ideas.map(idea => ({ id: uid('idea'), created_at: new Date().toISOString(), status: 'idea', ...idea }));
  } catch (error) {
    console.warn('Edge assistant failed, using local generator.', error);
    return null;
  }
}

async function addIdeaToRemote(idea) {
  state.ideas.unshift(idea);
  saveLocalState();
  if (supabaseClient && currentUser) {
    await upsertRemote('ml_content_ideas', appIdeaToDbIdea(idea));
  }
}

async function uploadImage(file, folder = activeMonthKey) {
  if (!supabaseClient || !currentUser) {
    return await fileToDataUrl(file);
  }
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const path = `${currentUser.id}/${folder}/${uid('img')}-${safeName}`;
  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, url: await signedUrl(path) };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ path: '', url: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveMoodboardRemote() {
  const board = state.moodboards[activeMonthKey];
  saveLocalState();
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from('ml_moodboards').upsert({
    user_id: currentUser.id,
    month_key: activeMonthKey,
    title: board.title,
    theme: board.theme,
    recipe: board.recipe,
    notes: board.notes,
    cover_path: board.cover_path || '',
    cover_url: board.cover_url && board.cover_url.startsWith('data:') ? '' : board.cover_url
  }, { onConflict: 'user_id,month_key' });
  if (error) console.error(error);
}

async function saveAssetRemote(asset) {
  saveLocalState();
  if (!supabaseClient || !currentUser || !asset.path) return;
  const { error } = await supabaseClient.from('ml_moodboard_assets').upsert({
    id: asset.id,
    month_key: asset.month_key,
    storage_path: asset.path,
    x: Math.round(asset.x),
    y: Math.round(asset.y),
    width: Math.round(asset.width),
    rotation: Math.round(asset.rotation),
    z: asset.z || 1
  });
  if (error) console.error(error);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bindEvents() {
  $$('.nav-link').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $$('[data-view-jump]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.viewJump)));

  $('#assistantForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      theme: $('#aiTheme').value.trim(),
      recipe: $('#aiRecipe').value.trim(),
      effort: $('#aiEffort').value,
      platform: $('#aiPlatform').value,
      goal: $('#aiGoal').value,
      note: $('#aiNote').value.trim()
    };
    $('#ideaOutput').className = 'idea-output empty-state';
    $('#ideaOutput').innerHTML = '<p class="script-title">Ideen werden vorbereitet...</p><p>Falls die Edge Function nicht aktiv ist, nutze ich automatisch den eingebauten Menu-Letters-Generator.</p>';
    const aiIdeas = await tryAiAssistant(payload);
    const generated = aiIdeas || generateContentIdeas(payload);
    for (const idea of generated) await addIdeaToRemote(idea);
    renderAll();
  });

  $('#clearIdeas').addEventListener('click', async () => {
    if (!confirm('Alle Content-Ideen löschen?')) return;
    const ids = state.ideas.map(idea => idea.id);
    state.ideas = [];
    saveLocalState();
    if (supabaseClient && currentUser) {
      for (const id of ids) await deleteRemote('ml_content_ideas', id);
    }
    renderAll();
  });

  $('#ideaOutput').addEventListener('click', async (event) => {
    const button = event.target.closest('.save-idea');
    if (!button) return;
    const card = event.target.closest('.idea-card');
    const idea = state.ideas.find(item => item.id === card.dataset.id);
    if (!idea) return;
    const todo = { id: uid('todo'), title: `Filmen: ${idea.title}`, due_date: '', priority: 'normal', status: 'open', notes: idea.hook };
    state.todos.unshift(todo);
    await upsertRemote('ml_todos', todo);
    renderAll();
  });

  $('#todoForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const todo = {
      id: uid('todo'),
      title: $('#todoTitle').value.trim(),
      due_date: $('#todoDate').value,
      priority: $('#todoPriority').value,
      status: 'open',
      notes: ''
    };
    state.todos.unshift(todo);
    await upsertRemote('ml_todos', todo);
    event.target.reset();
    renderAll();
  });

  $$('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    activeTodoFilter = btn.dataset.filter;
    $$('.filter-btn').forEach(item => item.classList.toggle('active', item === btn));
    renderTodos();
  }));

  $('#todoList').addEventListener('click', async (event) => {
    const item = event.target.closest('.todo-item');
    if (!item) return;
    const todo = state.todos.find(t => t.id === item.dataset.id);
    if (!todo) return;
    if (event.target.matches('.todo-check')) {
      todo.status = event.target.checked ? 'done' : 'open';
      await upsertRemote('ml_todos', todo);
      renderAll();
    }
    if (event.target.matches('.delete-todo')) {
      state.todos = state.todos.filter(t => t.id !== todo.id);
      await deleteRemote('ml_todos', todo.id);
      renderAll();
    }
    if (event.target.matches('.edit-date')) {
      const nextDate = prompt('Neues Datum im Format YYYY-MM-DD:', todo.due_date || isoDate(new Date()));
      if (nextDate !== null) {
        todo.due_date = nextDate.trim();
        await upsertRemote('ml_todos', todo);
        renderAll();
      }
    }
  });

  $('#todoList').addEventListener('focusout', async (event) => {
    if (!event.target.matches('.todo-title')) return;
    const item = event.target.closest('.todo-item');
    const todo = state.todos.find(t => t.id === item.dataset.id);
    if (!todo) return;
    todo.title = event.target.textContent.trim() || todo.title;
    await upsertRemote('ml_todos', todo);
    renderAll();
  });

  setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);

  $('#eventForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const pickedDate = getDateFromDropdowns('#eventDay', '#eventMonth', '#eventYear');
    const item = {
      id: uid('event'),
      title: $('#eventTitle').value.trim(),
      date: pickedDate,
      type: $('#eventType').value,
      notes: $('#eventNotes').value.trim()
    };
    selectedCalendarDate = pickedDate;
    calendarDate = parseIsoDate(pickedDate);
    state.events.push(item);
    await upsertRemote('ml_events', item);
    event.target.reset();
    setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);
    renderAll();
  });

  $('#prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  $('#nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
  $('#todayBtn').addEventListener('click', () => {
    const today = new Date();
    calendarDate = today;
    selectedCalendarDate = isoDate(today);
    setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);
    renderCalendar();
  });
  $('#calendarMonthSelect').addEventListener('change', () => {
    calendarDate.setMonth(Number($('#calendarMonthSelect').value));
    renderCalendar();
  });
  $('#calendarYearSelect').addEventListener('change', () => {
    calendarDate.setFullYear(Number($('#calendarYearSelect').value));
    renderCalendar();
  });

  $('#calendarGrid').addEventListener('click', async (event) => {
    const day = event.target.closest('.calendar-day');
    if (!day) return;
    selectedCalendarDate = day.dataset.date;
    setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);

    const chip = event.target.closest('.event-chip');
    if (chip?.dataset.todoId) {
      const todo = state.todos.find(t => t.id === chip.dataset.todoId);
      if (todo) {
        todo.status = todo.status === 'done' ? 'open' : 'done';
        await upsertRemote('ml_todos', todo);
      }
      renderAll();
      return;
    }

    if (chip?.dataset.id) {
      openEventModal(chip.dataset.id);
      renderCalendar();
      return;
    }

    if (event.target.matches('.day-add')) {
      $('#eventTitle').focus();
    }

    renderCalendar();
  });

  $('#quickAddSelectedDay').addEventListener('click', () => {
    setupDateDropdowns('#eventDay', '#eventMonth', '#eventYear', selectedCalendarDate);
    $('#eventTitle').focus();
  });

  $('#dayAgenda').addEventListener('click', async (event) => {
    const eventItem = event.target.closest('.agenda-item[data-id]');
    const todoItem = event.target.closest('.agenda-item[data-todo-id]');

    if (event.target.matches('.edit-event') && eventItem) {
      openEventModal(eventItem.dataset.id);
      return;
    }

    if (event.target.matches('.delete-event') && eventItem) {
      if (!confirm('Diesen Kalendereintrag löschen?')) return;
      state.events = state.events.filter(item => item.id !== eventItem.dataset.id);
      await deleteRemote('ml_events', eventItem.dataset.id);
      renderAll();
      return;
    }

    if (event.target.matches('.toggle-agenda-todo') && todoItem) {
      const todo = state.todos.find(t => t.id === todoItem.dataset.todoId);
      if (!todo) return;
      todo.status = todo.status === 'done' ? 'open' : 'done';
      await upsertRemote('ml_todos', todo);
      renderAll();
    }
  });

  const closeEventModalBtn = $('#closeEventModal');
  if (closeEventModalBtn) closeEventModalBtn.addEventListener('click', closeEventModal);

  const eventModalEl = $('#eventModal');
  if (eventModalEl) {
    eventModalEl.addEventListener('click', (event) => {
      if (event.target.id === 'eventModal') closeEventModal();
    });
  }

  const eventEditForm = $('#eventEditForm');
  if (eventEditForm) eventEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const item = state.events.find(eventItem => eventItem.id === editingEventId);
    if (!item) return;
    item.title = $('#editEventTitle').value.trim();
    item.date = getDateFromDropdowns('#editEventDay', '#editEventMonth', '#editEventYear');
    item.type = $('#editEventType').value;
    item.notes = $('#editEventNotes').value.trim();
    selectedCalendarDate = item.date;
    calendarDate = parseIsoDate(item.date);
    await upsertRemote('ml_events', item);
    closeEventModal();
    renderAll();
  });

  const deleteEventFromModalBtn = $('#deleteEventFromModal');
  if (deleteEventFromModalBtn) deleteEventFromModalBtn.addEventListener('click', async () => {
    if (!editingEventId) return;
    if (!confirm('Diesen Kalendereintrag löschen?')) return;
    state.events = state.events.filter(item => item.id !== editingEventId);
    await deleteRemote('ml_events', editingEventId);
    closeEventModal();
    renderAll();
  });

  $('#yearGrid').addEventListener('click', (event) => {
    const card = event.target.closest('.month-card');
    if (!card) return;
    activeMonthKey = card.dataset.key;
    setView('moodboard');
  });

  $('#addYearTask').addEventListener('click', async () => {
    const year = new Date().getFullYear();
    for (let m = 0; m < 12; m++) {
      const deadline = `${year}-${String(m + 1).padStart(2, '0')}-28`;
      const shipping = `${year}-${String(m + 1).padStart(2, '0')}-15`;
      if (!state.events.some(e => e.date === deadline && e.title.includes('Abo-Anmeldeschluss'))) {
        state.events.push({ id: uid('event'), title: 'Abo-Anmeldeschluss 23:59', date: deadline, type: 'business', notes: '' });
      }
      if (!state.events.some(e => e.date === shipping && e.title.includes('Versand Menu Letters'))) {
        state.events.push({ id: uid('event'), title: 'Versand Menu Letters', date: shipping, type: 'shipping', notes: '' });
      }
    }
    saveLocalState();
    if (supabaseClient && currentUser) {
      for (const item of state.events) await upsertRemote('ml_events', item);
    }
    renderAll();
  });

  $('#moodMonthSelect').addEventListener('change', () => {
    saveMoodboardFromInputs();
    activeMonthKey = $('#moodMonthSelect').value;
    selectedAssetId = null;
    renderMoodboard();
  });

  ['moodTheme', 'moodRecipe', 'moodNotes'].forEach(id => {
    $(`#${id}`).addEventListener('input', () => saveMoodboardFromInputs(false));
  });

  $('#saveMoodboard').addEventListener('click', async () => {
    saveMoodboardFromInputs();
    await saveMoodboardRemote();
    alert('Moodboard gespeichert.');
  });

  $('#coverInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadImage(file, `${activeMonthKey}/covers`);
    const board = state.moodboards[activeMonthKey];
    board.cover_path = uploaded.path;
    board.cover_url = uploaded.url;
    await saveMoodboardRemote();
    renderAll();
  });

  $('#photoInput').addEventListener('change', async (event) => {
    const files = [...event.target.files || []];
    let z = Math.max(0, ...state.assets.map(a => a.z || 0));
    for (const file of files) {
      const uploaded = await uploadImage(file, `${activeMonthKey}/photos`);
      const asset = {
        id: uid('asset'),
        month_key: activeMonthKey,
        path: uploaded.path,
        url: uploaded.url,
        x: 90 + Math.random() * 220,
        y: 180 + Math.random() * 220,
        width: 180,
        rotation: Math.round(Math.random() * 12 - 6),
        z: ++z
      };
      state.assets.push(asset);
      await saveAssetRemote(asset);
    }
    event.target.value = '';
    renderAll();
  });

  bindPhotoCanvas();

  const settingsForm = $('#settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await connectSupabaseFrom('settings');
    });
  }

  const loginConnectBtn = $('#loginConnectBtn');
  if (loginConnectBtn) {
    loginConnectBtn.addEventListener('click', async () => {
      await connectSupabaseFrom('login');
    });
  }

  const signUpBtn = $('#signUpBtn');
  if (signUpBtn) signUpBtn.addEventListener('click', async () => signUpWithEmail('settings'));

  const loginSignUpBtn = $('#loginSignUpBtn');
  if (loginSignUpBtn) loginSignUpBtn.addEventListener('click', async () => signUpWithEmail('login'));

  const signInBtn = $('#signInBtn');
  if (signInBtn) signInBtn.addEventListener('click', async () => signInWithEmail('settings'));

  const loginSignInBtn = $('#loginSignInBtn');
  if (loginSignInBtn) loginSignInBtn.addEventListener('click', async () => signInWithEmail('login'));

  const signOutBtn = $('#signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (!supabaseClient) return;
      await supabaseClient.auth.signOut();
    });
  }
}

function saveMoodboardFromInputs(persist = true) {
  const board = state.moodboards[activeMonthKey] || { month_key: activeMonthKey, title: MONTHS[Number(activeMonthKey.slice(5)) - 1] };
  board.theme = $('#moodTheme').value;
  board.recipe = $('#moodRecipe').value;
  board.notes = $('#moodNotes').value;
  state.moodboards[activeMonthKey] = board;
  if (persist) saveLocalState();
}

function bindPhotoCanvas() {
  const canvas = $('#photoCanvas');
  let dragging = null;

  canvas.addEventListener('pointerdown', (event) => {
    const note = event.target.closest('.photo-note');
    if (!note) return;
    const asset = state.assets.find(a => a.id === note.dataset.id);
    if (!asset) return;
    selectedAssetId = asset.id;
    const maxZ = Math.max(0, ...state.assets.map(a => a.z || 0));
    asset.z = maxZ + 1;
    if (event.target.closest('.photo-controls')) return;
    dragging = { asset, startX: event.clientX, startY: event.clientY, originalX: asset.x, originalY: asset.y };
    note.setPointerCapture(event.pointerId);
    renderAssets();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragging.asset.x = Math.max(0, dragging.originalX + (event.clientX - dragging.startX));
    dragging.asset.y = Math.max(0, dragging.originalY + (event.clientY - dragging.startY));
    const note = $(`.photo-note[data-id="${dragging.asset.id}"]`);
    if (note) {
      note.style.left = `${dragging.asset.x}px`;
      note.style.top = `${dragging.asset.y}px`;
      note.style.zIndex = dragging.asset.z;
    }
  });

  canvas.addEventListener('pointerup', async () => {
    if (dragging) await saveAssetRemote(dragging.asset);
    dragging = null;
  });

  canvas.addEventListener('click', async (event) => {
    const control = event.target.closest('.photo-controls button');
    if (!control) return;
    const note = event.target.closest('.photo-note');
    const asset = state.assets.find(a => a.id === note.dataset.id);
    if (!asset) return;
    const action = control.dataset.action;
    if (action === 'smaller') asset.width = Math.max(90, asset.width - 20);
    if (action === 'bigger') asset.width = Math.min(420, asset.width + 20);
    if (action === 'rotate-left') asset.rotation -= 8;
    if (action === 'rotate-right') asset.rotation += 8;
    if (action === 'delete') {
      state.assets = state.assets.filter(a => a.id !== asset.id);
      if (supabaseClient && currentUser && asset.path) await deleteRemote('ml_moodboard_assets', asset.id);
      saveLocalState();
      renderAssets();
      return;
    }
    await saveAssetRemote(asset);
    renderAssets();
  });
}

async function boot() {
  loadLocalState();
  bindEvents();
  renderAll();
  await initSupabase();
  renderAll();
}

boot();
