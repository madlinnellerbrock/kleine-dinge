'use strict';

const icon={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',inbox:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',check:'<path d="m5 12 4 4L19 6"/>',chevron:'<path d="m6 9 6 6 6-6"/>',back:'<path d="m15 18-6-6 6-6"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',edit:'<path d="M12 20h9M16 4l4 4L9 19H5v-4L16 4z"/>',arrow:'<path d="m9 18 6-6-6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>'};
const svg=(name)=>`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]||''}</svg>`;

const root = document.querySelector('#app');
const importFile = document.querySelector('#importFile');
const preview = document.documentElement.hasAttribute('data-preview');
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const tabs = [
  ['today', 'sun', 'Heute'],
  ['someday', 'inbox', 'Irgendwann', 'Hat noch Zeit'],
  ['self', 'heart', 'Mein Raum', 'Was mir wichtig ist']
];
const drafts = new Map();
const draftEmojis = new Map();
let data;
let tab = 'today';
let categoryId = null;
let activeTask = null;
let day = store.today();
let revealed = null;
let modalReturn = null;
let toastTimer;

function currentCategory() {
  return data.categories.find(category => category.id === categoryId);
}

function currentTasks() {
  return data.tasks.filter(task => task.area === tab);
}

function locate(id) {
  for (const task of data.tasks) {
    if (task.id === id) return { kind: 'task', item: task, list: data.tasks };
    const child = task.children.find(child => child.id === id);
    if (child) return { kind: 'sub', item: child, parent: task, list: task.children };
  }
  for (const category of data.categories) {
    if (category.id === id) return { kind: 'category', item: category, list: data.categories };
    const card = category.cards.find(card => card.id === id);
    if (card) return { kind: 'note', item: card, parent: category, list: category.cards };
  }
}

function persist() {
  return store.save(data).catch(() => {
    toast('Speichern fehlgeschlagen. Du kannst deine Daten als Backup exportieren.');
  });
}

function syncDay() {
  day = store.today();
  let changed = false;
  for (const task of data.tasks) {
    if (task.area === 'today' && (!task.day || (!task.done && task.day < day))) {
      task.day = day;
      changed = true;
    }
  }
  if (changed) persist();
  const date = $('[data-header-date]');
  if (date) date.textContent = dateLabel();
}

function dateLabel() {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function suggest(text) {
  return emojiGroups.find(group => group.words.test(text))?.emoji ?? data.defaultEmoji;
}

function updateDraftEmoji(field) {
  const marker = field.closest('.newtask')?.querySelector('.emoji');
  if (marker) marker.textContent = draftEmojis.get(field.dataset.edit + field.dataset.id) ?? suggest(field.value);
}

function editor(type, id, value = '', placeholder = '', label = placeholder) {
  return `<textarea rows="1" class="editable ${type}" data-edit="${type}" data-id="${esc(id)}" aria-label="${esc(label)}" placeholder="${esc(placeholder)}" spellcheck="true">\n${esc(value)}</textarea>`;
}

function button(action, id, label, contents, className = '', extra = '') {
  return `<button type="button" class="${className}" data-action="${action}" data-id="${esc(id)}" aria-label="${esc(label)}" ${extra}>${contents}</button>`;
}

function tile(value, id) {
  return button('emoji', id, 'Emoji ändern', esc(value), 'emoji');
}

function check(item) {
  return button('tick', item.id, 'Erledigt', `<span>${svg('check')}</span>`,
    'check-target', `role="checkbox" aria-checked="${item.done}"`);
}

function actions(kind) {
  const left = kind === 'task'
    ? [['move', tab === 'today' ? 'Nach Irgendwann verschieben' : 'Nach Heute verschieben', tab === 'today' ? 'inbox' : 'sun']]
    : kind === 'category' ? [['editcat', 'Kategorie bearbeiten', 'edit']] : [];
  return { left, right: [['duplicate', 'Duplizieren', 'copy'], ['delete', 'Löschen', 'trash']] };
}

function frame(item, kind, body) {
  return `<div class="swipeframe" data-item="${esc(item.id)}" data-kind="${kind}">
    ${Object.entries(actions(kind)).filter(([, items]) => items.length).map(([side, items]) =>
      `<div class="actions ${side}" inert>${items.map(([action, label, glyph]) =>
        button(action, item.id, label, svg(glyph), 'action ' + action)).join('')}</div>`).join('')}
    ${body}
  </div>`;
}

function subtaskToggle(task) {
  return button('collapse', task.id, 'Unteraufgaben anzeigen oder einklappen', svg('chevron'),
    'chevron', `aria-expanded="${!task.collapsed}"`);
}

function subtaskProgress(task) {
  return `${task.children.filter(child => child.done).length} von ${task.children.length} erledigt`;
}

function subtaskCard(child) {
  return frame(child, 'sub', `<div class="subrow face ${child.done ? 'completed' : ''}">
    ${check(child)}<div class="grow">${editor('sub-text', child.id, child.text, 'Unteraufgabe')}</div>
  </div>`);
}

function taskCard(task) {
  return frame(task, 'task', `<article class="task face ${task.done ? 'completed' : ''}">
    <div class="taskrow">
      ${tile(task.emoji, task.id)}
      <div class="grow task-summary">
        ${editor('task-text', task.id, task.text, 'Aufgabe', 'Aufgabentext')}
        ${task.children.length ? `<div class="progress">${subtaskProgress(task)}</div>` : ''}
      </div>
      ${task.children.length ? subtaskToggle(task) : ''}
      ${check(task)}
    </div>
    <div class="subs" ${task.collapsed || !task.children.length ? 'hidden' : ''}>
      ${task.children.map(subtaskCard).join('')}
    </div>
  </article>`);
}

function noteCard(note) {
  return frame(note, 'note', `<article class="note face"><div class="noterow">
    ${tile(note.emoji, note.id)}<div class="grow">${editor('note-text', note.id, note.text, 'Gedanke')}</div>
  </div></article>`);
}

function categoryCard(category) {
  return frame(category, 'category', `<article class="category face"><div class="catrow">
    ${tile(category.emoji, category.id)}
    ${button('open-category', category.id, category.title,
      `<span>${esc(category.title)}</span>${svg('arrow')}`, 'category-link')}
  </div></article>`);
}

function render({ scroll = false } = {}) {
  const scrollTop = scroll ? 0 : root.querySelector('.shell')?.scrollTop ?? 0;
  activeTask = null;
  revealed = null;
  const category = currentCategory();
  const [, , title, caption] = tabs.find(([key]) => key === tab);
  const heading = category?.title ?? title;
  let type = 'new-task';
  let id = tab;
  let placeholder = 'Neue Aufgabe …';
  let cards = [];
  if (category) {
    type = 'new-note';
    id = category.id;
    placeholder = 'Neuer Gedanke …';
    cards = category.cards.map(noteCard);
  } else if (tab === 'self') {
    type = 'new-category';
    id = 'self';
    placeholder = 'Neue Kategorie …';
    cards = data.categories.map(categoryCard);
  } else {
    cards = currentTasks().map(taskCard);
  }
  root.innerHTML = `<main class="shell">
    <header class="header${category ? ' category-header' : ''}">
      ${category ? button('back', '', 'Zurück zu „' + title + '“', svg('back') + ' ' + esc(title), 'back') :
        button('settings', '', 'Einstellungen', svg('settings'), 'toolbar')}
      ${category ? '' : `<p class="eyebrow"${tab === 'today' ? ' data-header-date' : ''}>${esc(tab === 'today' ? dateLabel() : caption)}</p>`}
      <h1 class="title${category ? ' category-title' : ''}">${esc(heading)}</h1>
    </header>
    <div class="list">${cards.join('')}
      <div class="newtask">
        ${button('draft-emoji', type + id, 'Emoji für neuen Eintrag auswählen',
          esc(draftEmojis.get(type + id) ?? suggest(drafts.get(type + id) ?? '')), 'emoji')}
        <div class="grow">${editor(type, id, drafts.get(type + id), placeholder)}</div>
        ${button('add', id, category ? 'Gedanken hinzufügen' : tab === 'self' ? 'Kategorie hinzufügen' : 'Aufgabe hinzufügen', svg('plus'), 'add')}
      </div>
    </div>
  </main>
  <nav class="nav" aria-label="Hauptnavigation">${tabs.map(([key, glyph, label]) =>
    button('nav', key, label, svg(glyph) + `<span>${label}</span>`, tab === key ? 'active' : '',
      tab === key ? 'aria-current="page"' : '')).join('')}</nav>`;
  root.querySelectorAll('textarea').forEach(size);
  root.querySelector('.shell').scrollTop = scrollTop;
}

function findEditor(type, id) {
  return root.querySelector(`textarea[data-edit="${type}"][data-id="${CSS.escape(id)}"]`);
}

function size(field) {
  field.style.height = 'auto';
  const minHeight = field.matches('.task-summary > .editable:not(:last-child)') ? 22 : 28;
  field.style.height = Math.max(minHeight, field.scrollHeight) + 'px';
  field.closest('.noterow')?.classList.toggle('multiline', field.scrollHeight > 37);
}

function focusEnd(field) {
  if (!field) return;
  field.focus({ preventScroll: true });
  field.setSelectionRange(field.value.length, field.value.length);
  field.scrollIntoView({ block: 'nearest' });
}

function taskFace(id) {
  return root.querySelector(`[data-item="${CSS.escape(id)}"] > .task`);
}

function deactivateTask() {
  if (!activeTask) return;
  const face = taskFace(activeTask);
  const entry = face?.querySelector('.subentry');
  const field = entry?.querySelector('textarea');
  if (field?.value.trim()) drafts.set('new-sub' + activeTask, field.value);
  entry?.remove();
  face?.classList.remove('focused');
  activeTask = null;
}

function activateTask(id) {
  if (activeTask === id) return;
  deactivateTask();
  const face = taskFace(id);
  if (!face) return;
  activeTask = id;
  face.classList.add('focused');
  face.insertAdjacentHTML('beforeend', `<div class="subentry">
    <span class="hint" aria-hidden="true">↳</span><div class="grow">
      ${editor('new-sub', id, drafts.get('new-sub' + id), 'Neue Unteraufgabe …')}</div>
    ${button('add', id, 'Unteraufgabe hinzufügen', svg('plus'), 'add')}
  </div>`);
  size(face.querySelector('.subentry textarea'));
}

function replaceTask(id) {
  const face = taskFace(id);
  const task = locate(id)?.item;
  if (!face || !task) return;
  const focused = activeTask === id;
  if (focused) deactivateTask();
  const frame = face.closest('.swipeframe');
  frame.insertAdjacentHTML('beforebegin', taskCard(task));
  frame.remove();
  taskFace(id).querySelectorAll('textarea').forEach(size);
  if (focused) activateTask(id);
}

function createFrom(field, { keepFocus = true } = {}) {
  const { edit, id } = field.dataset;
  const text = field.value.trim();
  if (!text) return;
  const base = { id: store.uid(), emoji: draftEmojis.get(edit + id) ?? suggest(text) };
  if (edit === 'new-task') {
    data.tasks.push({ ...base, text, area: id, day: id === 'today' ? day : null, done: false, collapsed: false, children: [] });
  } else if (edit === 'new-sub') {
    const task = locate(id)?.item;
    if (!task) return;
    task.children.push({ id: base.id, text, done: false });
    task.collapsed = false;
  } else if (edit === 'new-note') {
    const category = currentCategory();
    if (!category) return;
    category.cards.push({ ...base, text });
  } else if (edit === 'new-category') {
    data.categories.push({ ...base, title: text.replace(/\s*\n\s*/g, ' '), cards: [] });
  }
  drafts.delete(edit + id);
  draftEmojis.delete(edit + id);
  field.value = '';
  persist();
  if (edit === 'new-sub') {
    const task = locate(id).item;
    const face = taskFace(id);
    const subs = face.querySelector('.subs');
    if (!face.querySelector('.chevron')) {
      face.querySelector('.taskrow > .check-target').insertAdjacentHTML('beforebegin', subtaskToggle(task));
      const summary = face.querySelector('.task-summary');
      summary.insertAdjacentHTML('beforeend', '<div class="progress"></div>');
      size(summary.querySelector('textarea'));
    }
    face.querySelector('.chevron').setAttribute('aria-expanded', 'true');
    face.querySelector('.progress').textContent = subtaskProgress(task);
    subs.insertAdjacentHTML('beforeend', subtaskCard(task.children.at(-1)));
    subs.hidden = false;
    subs.querySelectorAll('textarea').forEach(size);
  } else {
    const composer = field.closest('.newtask');
    if (edit === 'new-task') composer.insertAdjacentHTML('beforebegin', taskCard(data.tasks.at(-1)));
    if (edit === 'new-category') composer.insertAdjacentHTML('beforebegin', categoryCard(data.categories.at(-1)));
    if (edit === 'new-note') composer.insertAdjacentHTML('beforebegin', noteCard(currentCategory().cards.at(-1)));
    composer.previousElementSibling.querySelectorAll('textarea').forEach(size);
    updateDraftEmoji(field);
  }
  size(field);
  if (keepFocus) focusEnd(field);
}

function toast(message, undo) {
  clearTimeout(toastTimer);
  const element = $('#status');
  element.innerHTML = `<span role="status">${esc(message)}</span>${undo ? '<button type="button">Rückgängig</button>' : ''}`;
  element.hidden = false;
  const dismiss = () => { element.hidden = true; };
  element.querySelector('button')?.addEventListener('click', () => {
    dismiss();
    undo();
    persist();
    render();
  });
  toastTimer = setTimeout(dismiss, undo ? 8500 : 4500);
}

function mutate(id, action) {
  const entry = locate(id);
  if (!entry) return;
  const { item, kind, list } = entry;
  const index = list.indexOf(item);
  let undo;
  let message;
  if (action === 'delete') {
    list.splice(index, 1);
    undo = () => list.splice(index, 0, item);
    message = 'Gelöscht';
  } else if (action === 'duplicate') {
    const copy = { ...item, id: store.uid() };
    if (kind === 'task' || kind === 'sub') copy.done = false;
    if (kind === 'task') copy.children = item.children.map(child => ({ ...child, id: store.uid(), done: false }));
    if (kind === 'category') copy.cards = item.cards.map(card => ({ ...card, id: store.uid() }));
    list.splice(index + 1, 0, copy);
    undo = () => { const position = list.indexOf(copy); if (position >= 0) list.splice(position, 1); };
    message = 'Dupliziert';
  } else if (action === 'move' && kind === 'task') {
    const { area, day: previousDay } = item;
    item.area = area === 'today' ? 'someday' : 'today';
    item.day = item.area === 'today' ? day : null;
    list.splice(index, 1);
    list.push(item);
    undo = () => {
      list.splice(list.indexOf(item), 1);
      Object.assign(item, { area, day: previousDay });
      list.splice(index, 0, item);
    };
    message = item.area === 'today' ? 'Nach Heute verschoben' : 'Nach Irgendwann verschoben';
  }
  if (!undo) return;
  closeSheet();
  persist();
  render();
  toast(message, undo);
}

function reorder(from, to, after) {
  const a = locate(from);
  const b = locate(to);
  if (!a || !b || a.item === b.item || a.list !== b.list || a.item.area !== b.item.area) return;
  a.list.splice(a.list.indexOf(a.item), 1);
  a.list.splice(a.list.indexOf(b.item) + Number(after), 0, a.item);
  persist();
  render();
}

function resetView() {
  stopGesture();
  closeSheet();
  $('#status').hidden = true;
  activeTask = null;
  categoryId = null;
  drafts.clear();
  draftEmojis.clear();
  render();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'Kleine Dinge', exportedAt: new Date().toISOString(), data }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kleine-dinge-backup-' + day + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const next = store.normalize(raw.data ?? raw);
    if (!confirm('Dieses Backup importieren? Es ersetzt deine aktuellen Aufgaben und Gedanken.')) return;
    data = next;
    resetView();
    syncDay();
    await store.save(data);
    toast('Backup importiert');
  } catch (error) {
    toast('Backup konnte nicht gespeichert oder gelesen werden. ' + error.message);
  } finally {
    importFile.value = '';
  }
});

const dialog = $('#dialog');

function sheet(title, body, focusSelector) {
  if (!dialog.open) modalReturn = document.activeElement;
  dialog.innerHTML = `<div class="sheet"><div class="sheet-header"><h2 id="sheet-title">${esc(title)}</h2>
    ${button('close', '', 'Schließen', svg('close'), 'toolbar')}</div>${body}</div>`;
  if (!dialog.open) dialog.showModal();
  if (focusSelector) dialog.querySelector(focusSelector)?.focus();
}

function closeSheet() {
  if (dialog.open) dialog.close();
}

dialog.addEventListener('close', () => {
  if (modalReturn?.isConnected && !modalReturn.closest('[inert]')) modalReturn.focus({ preventScroll: true });
  modalReturn = null;
});

dialog.addEventListener('click', event => {
  if (event.target === dialog) closeSheet();
});

function itemMenu(id) {
  const entry = locate(id);
  if (!entry) return;
  const { kind, item, list } = entry;
  const visibleList = kind === 'task' ? list.filter(task => task.area === item.area) : list;
  const position = visibleList.indexOf(item);
  const moves = [
    [visibleList[position - 1], 'Nach oben', 'before'], [visibleList[position + 1], 'Nach unten', 'after']
  ].filter(([target]) => target);
  sheet(kind === 'category' ? 'Kategorie' : kind === 'note' ? 'Gedanke' : 'Aufgabe', [
    ...Object.values(actions(kind)).flat().map(([action, label, glyph]) =>
      button(action, id, label, svg(glyph) + '<span>' + esc(label) + '</span>', 'setting')),
    ...moves.map(([target, label, side]) =>
      button('reorder', id, label, esc(label), 'setting', `data-target="${esc(target.id)}" data-side="${side}"`))
  ].join(''));
}

function settings(focusSelector) {
  const currentEmoji = data.defaultEmoji;
  const emojiName = emojiAnnotations[currentEmoji]?.[0] ?? currentEmoji;
  sheet('Deine App 🌱', `
    ${button('default-emoji', '', 'Standard-Emoji ändern, aktuell ' + emojiName,
      '<span aria-hidden="true">' + esc(currentEmoji) + '</span> Standard-Emoji ändern', 'setting')}
    ${button('backup', '', 'Backup exportieren', 'Backup exportieren', 'setting')}
    ${button('import', '', 'Backup importieren', 'Backup importieren', 'setting')}
    ${button('reset', '', 'Alle Daten zurücksetzen', 'Alle Daten zurücksetzen', 'setting danger')}
    <p class="hintline">Deine Aufgaben und Gedanken bleiben auf diesem Gerät. Mit einem Backup kannst du sie mitnehmen.</p>
    <p class="hintline">Für Kartenaktionen am Computer mit der rechten Maustaste klicken. Auf dem Handy kannst du wischen oder eine Karte gedrückt halten.</p>
    ${preview ? '<p class="hintline">Testvorschau mit eigenem Datenspeicher. Für die iPhone-Installation ist die über HTTPS veröffentlichte Version vorgesehen.</p>' : ''}`, focusSelector);
}

const emojiGroups = [
  ['📖', 'lesen|bücher|buch|lektüre|roman'], ['🛒', 'einkauf|einkaufen|lebensmittel|supermarkt'],
  ['🧹', 'putzen|saugen|aufräumen|reinigung'], ['🧺', 'wäsche|waschen|bügeln'],
  ['🏸', 'badminton'], ['💪', 'sport|training|gym|fitness'], ['🏃', 'laufen|joggen'],
  ['🧘', 'yoga|meditieren|meditation'], ['🎨', 'design|malen|zeichnen|kreativ'],
  ['📸', 'fotograf|fotos|kamera'], ['🌿', 'pflanzen|garten|gießen'], ['💧', 'wasser|trinken'],
  ['☕', 'kaffee|café|pause'], ['🍳', 'kochen|rezept|frühstück'], ['🍕', 'pizza'],
  ['🎧', 'musik|podcast|hören'], ['💌', 'mail|e-mail|nachricht'], ['☎️', 'telefon|anrufen|anruf'],
  ['🧳', 'reise|urlaub|packen'], ['🇳🇴', 'norwegen|norwegisch'], ['🚗', 'auto|werkstatt'],
  ['💻', 'computer|laptop|arbeit'], ['✍️', 'schreiben|journal|tagebuch'],
  ['🌷', 'blume|tulpe'], ['🤎', 'herz|liebe|braun'], ['🏡', 'zuhause|haus|wohnen'],
  ['🌙', 'schlafen|abend|mond'], ['☀️', 'sonne|morgen'], ['✨', 'stern|glitzern'],
  ['📅', 'termin|kalender'], ['🎁', 'geschenk|geburtstag'], ['🐈', 'katze|tier']
].map(([emoji, keywords]) => ({ emoji, keywords, words: new RegExp('(^|[^\\p{L}])(?:' + keywords + ')(?=$|[^\\p{L}])', 'iu') }));

const allEmoji = [...new Set([...emojiCatalog, ...Object.values(emojiSets).flat(), ...emojiGroups.map(group => group.emoji)])];
let emojiSearchIndex;

const toneAliases = {
  '🫱‍🫲': '🤝', '👩‍🤝‍👩': '👭', '👩‍🤝‍👨': '👫', '👨‍🤝‍👨': '👬',
  '🧑‍❤‍💋‍🧑': '💏', '🧑‍❤‍🧑': '💑',
  '🧑‍🫯‍🧑': '🤼', '👨‍🫯‍👨': '🤼‍♂', '👩‍🫯‍👩': '🤼‍♀',
  '🧑‍🐰‍🧑': '👯', '👨‍🐰‍👨': '👯‍♂', '👩‍🐰‍👩': '👯‍♀'
};

function toneFamily(emoji) {
  const base = emoji.replace(/[\p{Emoji_Modifier}\uFE0F]/gu, '');
  return toneAliases[base] ?? base;
}

const emojiTones = new Map();
const neutralEmoji = new Map(allEmoji.filter(emoji => !/\p{Emoji_Modifier}/u.test(emoji))
  .map(emoji => [toneFamily(emoji), emoji]));
for (const emoji of allEmoji) {
  if (!/\p{Emoji_Modifier}/u.test(emoji)) continue;
  const family = toneFamily(emoji);
  if (!family) continue;
  if (!emojiTones.has(family)) emojiTones.set(family, neutralEmoji.has(family) ? [neutralEmoji.get(family)] : []);
  emojiTones.get(family).push(emoji);
}

function normalizeEmojiSearch(text) {
  return text.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findEmoji(query) {
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u20E3/u.test(query)) {
    const glyph = query.replace(/\uFE0F/g, '');
    const matches = allEmoji.filter(emoji => emoji.replace(/\uFE0F/g, '').includes(glyph));
    const exact = matches.find(emoji => emoji.replace(/\uFE0F/g, '') === glyph);
    if (exact) return [exact, ...matches.filter(emoji => emoji !== exact)];
    const segments = Intl.Segmenter ? [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(query)] : [...query];
    return segments.length === 1 ? [query, ...matches] : matches;
  }
  const normalized = normalizeEmojiSearch(query);
  if (!normalized) return [];
  const words = normalized.split(' ');
  emojiSearchIndex ??= allEmoji.map(emoji => {
    const [name, keywords] = emojiAnnotations[emoji] ?? ['', ''];
    const aliases = emojiGroups.find(group => group.emoji === emoji)?.keywords ?? '';
    return { emoji, name: normalizeEmojiSearch(name), text: normalizeEmojiSearch([name, keywords, aliases].join(' ')) };
  });
  const exact = [];
  const related = [];
  for (const entry of emojiSearchIndex) {
    if (entry.name === normalized) exact.push(entry.emoji);
    else if (words.every(word => entry.text.includes(word))) related.push(entry.emoji);
  }
  return [...exact, ...related];
}

function setupEmojiTones(grid, popup, choice) {
  const sheetBody = grid.closest('.sheet');
  let timer;
  let press;
  let anchor;
  let ignoreClick;

  function cancelPress() {
    clearTimeout(timer);
    press = null;
  }

  function dismiss(restoreFocus = false) {
    cancelPress();
    if (restoreFocus) anchor?.focus({ preventScroll: true });
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    anchor = null;
    popup.hidden = true;
  }

  function open(control, focusOption = false) {
    const tones = emojiTones.get(toneFamily(control.dataset.emoji));
    if (!tones || !control.isConnected || !dialog.open) return;
    dismiss();
    anchor = control;
    control.setAttribute('aria-expanded', 'true');
    popup.innerHTML = tones.map(emoji => choice(emoji)).join('');
    popup.hidden = false;

    const box = control.getBoundingClientRect();
    const sheetBox = sheetBody.getBoundingClientRect();
    const dialogBox = dialog.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = Math.max(dialogBox.top, viewport?.offsetTop ?? 0) + 6;
    const bottom = Math.min(dialogBox.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight)) - 6;
    const above = box.top - top - 6;
    const below = bottom - box.bottom - 6;
    const putAbove = above >= popup.scrollHeight || above >= below;
    popup.style.maxHeight = Math.max(48, putAbove ? above : below) + 'px';
    const left = (box.left + box.right - popup.offsetWidth) / 2 - sheetBox.left;
    popup.style.left = Math.max(6, Math.min(left, sheetBox.width - popup.offsetWidth - 6)) + 'px';
    popup.style.top = (putAbove ? box.top - popup.offsetHeight - 6 : box.bottom + 6) - sheetBox.top + 'px';
    popup.scrollTop = 0;
    if (focusOption) popup.querySelector('button')?.focus({ preventScroll: true });
  }

  sheetBody.addEventListener('pointerdown', event => {
    ignoreClick = null;
    if (popup.contains(event.target)) return;
    dismiss();
    const control = event.target.closest('.emojigrid [aria-expanded]');
    if (!control || !event.isPrimary || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      open(control);
      if (anchor === control) ignoreClick = control;
    }, 450);
  });
  sheetBody.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 9) cancelPress();
  });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) sheetBody.addEventListener(event, cancelPress);
  grid.addEventListener('scroll', () => dismiss(), { passive: true });
  grid.addEventListener('contextmenu', event => {
    if (event.target.closest('[aria-expanded]')) event.preventDefault();
  });
  grid.addEventListener('click', event => {
    if (ignoreClick && ignoreClick.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      ignoreClick = null;
    }
  });
  sheetBody.addEventListener('keydown', event => {
    if (event.key === 'Escape' && anchor) {
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    } else if (event.key === 'ArrowUp' && event.target.matches('.emojigrid [aria-expanded]')) {
      event.preventDefault();
      open(event.target, true);
    }
  });
  return dismiss;
}

function emojiPicker(id, { draft = false, forDefault = false } = {}) {
  if (!draft && !forDefault && !locate(id)) return;
  const categories = [...Object.keys(emojiSets), 'Alle'];
  let group = categories[0];
  sheet(forDefault ? 'Standard-Emoji auswählen' : 'Emoji auswählen', `<input class="search" type="search" aria-label="Emoji suchen oder einfügen"
    placeholder="Emoji suchen oder einfügen …" autocomplete="off">
    <div class="emoji-cats">${categories.map(name =>
      `<button type="button" data-set="${esc(name)}" aria-pressed="${name === group}">${esc(name)}</button>`).join('')}</div>
    <div class="emojigrid"></div><div class="emoji-tones" id="emoji-tones" role="group" aria-label="Hauttöne" hidden></div>
    <p class="hintline">Für Hauttöne ein Emoji gedrückt halten. Über das Suchfeld kannst du auch Emojis einfügen.</p>`);
  const search = dialog.querySelector('.search');
  const grid = dialog.querySelector('.emojigrid');
  function choice(emoji, extra = '') {
    return button(forDefault ? 'save-default-emoji' : 'choose-emoji', id, emojiAnnotations[emoji]?.[0] || emoji, esc(emoji), '',
      `data-emoji="${esc(emoji)}" ${draft ? 'data-draft' : ''} ${extra}`);
  }
  const dismissTones = setupEmojiTones(grid, dialog.querySelector('.emoji-tones'), choice);

  function fill() {
    dismissTones();
    const query = search.value.trim();
    const options = query ? findEmoji(query) : group === 'Alle' ? allEmoji : emojiSets[group];
    grid.innerHTML = options.length ? options.map(emoji => choice(emoji, emojiTones.has(toneFamily(emoji))
      ? 'aria-controls="emoji-tones" aria-expanded="false" aria-keyshortcuts="ArrowUp"' : '')).join('') :
      '<p class="hintline">Keine Emojis gefunden.</p>';
    grid.scrollTop = 0;
  }

  search.addEventListener('input', fill);
  dialog.querySelectorAll('[data-set]').forEach(control => control.addEventListener('click', () => {
    group = control.dataset.set;
    dialog.querySelectorAll('[data-set]').forEach(item => item.setAttribute('aria-pressed', String(item === control)));
    fill();
  }));
  fill();
}

function editCategory(id) {
  const entry = locate(id);
  if (!entry) return;
  sheet('Kategorie bearbeiten', `<form class="edit-category"><label for="category-title">Kategorietitel</label>
    <input id="category-title" class="search" value="${esc(entry.item.title)}" required>
    <div class="sheetrow"><button class="btn" type="submit">Speichern</button></div></form>`, '#category-title');
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#category-title').value.trim();
    if (!title) return;
    entry.item.title = title;
    closeSheet();
    persist();
    render();
  });
}

function trigger(control) {
  const { action, id } = control.dataset;
  switch (action) {
    case 'nav':
      tab = id;
      categoryId = null;
      render({ scroll: true });
      break;
    case 'back':
      categoryId = null;
      render({ scroll: true });
      break;
    case 'open-category':
      categoryId = id;
      render({ scroll: true });
      break;
    case 'add':
      createFrom(control.parentElement.querySelector('textarea'));
      break;
    case 'tick': {
      const entry = locate(id);
      entry.item.done = !entry.item.done;
      const face = control.closest('.face');
      face.classList.toggle('completed', entry.item.done);
      control.setAttribute('aria-checked', String(entry.item.done));
      if (entry.parent) {
        taskFace(entry.parent.id).querySelector('.progress').textContent = subtaskProgress(entry.parent);
      }
      persist();
      break;
    }
    case 'collapse': {
      const task = locate(id).item;
      task.collapsed = !task.collapsed;
      control.setAttribute('aria-expanded', String(!task.collapsed));
      const subs = taskFace(id).querySelector('.subs');
      subs.hidden = task.collapsed;
      if (!subs.hidden) subs.querySelectorAll('textarea').forEach(size);
      persist();
      break;
    }
    case 'emoji': emojiPicker(id); break;
    case 'draft-emoji': emojiPicker(id, { draft: true }); break;
    case 'default-emoji': emojiPicker('', { forDefault: true }); break;
    case 'save-default-emoji': {
      data.defaultEmoji = control.dataset.emoji;
      const field = root.querySelector('.newtask textarea');
      if (field) updateDraftEmoji(field);
      persist();
      settings('[data-action="default-emoji"]');
      break;
    }
    case 'choose-emoji': {
      const value = control.dataset.emoji;
      const draft = control.hasAttribute('data-draft');
      const marker = root.querySelector(`[data-action="${draft ? 'draft-emoji' : 'emoji'}"][data-id="${CSS.escape(id)}"]`);
      if (!marker) break;
      if (draft) draftEmojis.set(id, value);
      else locate(id).item.emoji = value;
      marker.textContent = value;
      closeSheet();
      persist();
      break;
    }
    case 'close': closeSheet(); break;
    case 'settings': settings(); break;
    case 'backup': exportBackup(); break;
    case 'import': importFile.click(); break;
    case 'reset':
      if (confirm('Alle Aufgaben und Gedanken löschen?')) {
        data = store.fresh();
        resetView();
        persist();
        toast('Daten zurückgesetzt');
      }
      break;
    case 'editcat': editCategory(id); break;
    case 'reorder':
      closeSheet();
      reorder(id, control.dataset.target, control.dataset.side === 'after');
      break;
    case 'move':
    case 'delete':
    case 'duplicate': mutate(id, action); break;
  }
}

let suppressClickUntil = 0;
let pressedComposer = null;
document.addEventListener('pointerdown', event => {
  pressedComposer = event.target.closest('.newtask');
});
document.addEventListener('pointercancel', () => { pressedComposer = null; });
document.addEventListener('keydown', () => { pressedComposer = null; }, { capture: true });
document.addEventListener('click', event => {
  pressedComposer = null;
  if (performance.now() < suppressClickUntil && root.contains(event.target)) {
    event.preventDefault();
    return;
  }
  const field = root.querySelector('textarea.new-task');
  if (field && !dialog.open && !field.closest('.newtask').contains(event.target)) {
    createFrom(field, { keepFocus: false });
  }
  const control = event.target.closest('[data-action]');
  if (control) {
    if (activeTask && !control.closest('.task') && !dialog.contains(control)) deactivateTask();
    if (!control.closest('.actions') && !dialog.contains(control)) setReveal(null);
    trigger(control);
    return;
  }
  if (!root.contains(event.target)) return;
  if (!event.target.closest('.actions')) setReveal(null);
  const face = event.target.closest('.task');
  if (face && !event.target.closest('textarea')) {
    const id = face.parentElement.dataset.item;
    activateTask(id);
    focusEnd(findEditor('new-sub', id));
  } else if (!face) deactivateTask();
});

root.addEventListener('focusin', event => {
  const face = event.target.closest('.task');
  if (event.target.matches('textarea') && face) activateTask(face.parentElement.dataset.item);
  else if (!face) deactivateTask();
});

root.addEventListener('focusout', event => {
  const composer = event.target.closest('.newtask');
  const field = composer?.querySelector('textarea.new-task');
  if (field) {
    // Safari can report no next focus target when tapping the composer's own buttons.
    const next = event.relatedTarget ?? pressedComposer;
    if (!dialog.open && !composer.contains(next)) createFrom(field, { keepFocus: false });
    return;
  }
  const face = event.target.closest('.task');
  if (!face || activeTask !== face.parentElement.dataset.item || face.contains(event.relatedTarget)) return;
  if (event.relatedTarget) deactivateTask();
  else setTimeout(() => {
    if (activeTask === face.parentElement?.dataset.item && !face.contains(document.activeElement) && !dialog.open) deactivateTask();
  }, 0);
});

root.addEventListener('input', event => {
  const field = event.target;
  if (!field.matches('textarea[data-edit]')) return;
  const { edit, id } = field.dataset;
  if (edit.startsWith('new-')) {
    drafts.set(edit + id, field.value);
    updateDraftEmoji(field);
  } else {
    const entry = locate(id);
    if (entry) {
      entry.item.text = field.value;
      persist();
    }
  }
  size(field);
});

function previousLine(field) {
  const { edit, id } = field.dataset;
  const entry = locate(id);
  const isChild = edit === 'new-sub' || edit === 'sub-text';
  const parent = edit === 'new-sub' ? entry?.item : entry?.parent;
  const list = isChild ? parent?.children : currentTasks();
  if (!list) return false;
  if (!['new-task', 'new-sub', 'task-text', 'sub-text'].includes(edit)) return false;
  const isNew = edit.startsWith('new-');
  const index = isNew ? list.length : list.indexOf(entry.item);
  const previous = list[index - 1];
  if (!previous && !isChild && isNew) return false;
  if (!isNew) {
    if (!isChild && entry.item.children.length) return false;
    entry.list.splice(entry.list.indexOf(entry.item), 1);
    persist();
    if (isChild) replaceTask(parent.id);
    else render();
  }
  const target = previous ? findEditor(isChild ? 'sub-text' : 'task-text', previous.id) :
    isChild ? findEditor('task-text', parent.id) : findEditor('new-task', tab);
  if (isChild && previous && parent.collapsed) {
    parent.collapsed = false;
    replaceTask(parent.id);
    focusEnd(findEditor('sub-text', previous.id));
    persist();
  } else focusEnd(target);
  return true;
}

function enter(field) {
  const { edit, id } = field.dataset;
  if (edit === 'note-text') return false;
  if (edit === 'new-sub' && !field.value.trim()) {
    const tasks = currentTasks();
    const next = tasks[tasks.findIndex(task => task.id === id) + 1];
    focusEnd(next ? findEditor('task-text', next.id) : findEditor('new-task', tab));
    return true;
  }
  if (edit.startsWith('new-')) createFrom(field);
  else {
    const entry = locate(id);
    if (!entry?.item.text.trim()) return true;
    const key = entry.parent?.id ?? id;
    activateTask(key);
    focusEnd(findEditor('new-sub', key));
  }
  return true;
}

root.addEventListener('keydown', event => {
  const field = event.target;
  if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && field.closest('[data-item]')) {
    event.preventDefault();
    itemMenu(field.closest('[data-item]').dataset.item);
    return;
  }
  if (event.key === 'Escape') setReveal(null);
  if (!field.matches('textarea[data-edit]') || event.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey && enter(field)) event.preventDefault();
  if (event.key === 'Backspace' && !field.value && previousLine(field)) event.preventDefault();
});

root.addEventListener('beforeinput', event => {
  const field = event.target;
  if (!event.cancelable || !field.matches('textarea[data-edit]') || event.isComposing) return;
  if (event.inputType === 'deleteContentBackward' && !field.value && previousLine(field)) event.preventDefault();
});

function setReveal(frame, direction) {
  if (revealed) {
    revealed.classList.remove('swipe-left', 'swipe-right');
    for (const side of revealed.querySelectorAll(':scope > .actions')) side.inert = true;
  }
  revealed = frame;
  if (frame) {
    frame.classList.add('swipe-' + direction);
    frame.querySelector(':scope > .actions.' + (direction === 'left' ? 'right' : 'left')).inert = false;
  }
}

root.addEventListener('contextmenu', event => {
  const frame = event.target.closest('[data-item]');
  if (!frame || event.target.matches('textarea:focus')) return;
  event.preventDefault();
  if (gesture) return;
  setReveal(null);
  itemMenu(frame.dataset.item);
});

let gesture;
function stopGesture() {
  if (!gesture) return;
  const { timer, frame, face, target, raf } = gesture;
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  frame.classList.remove('tracking', 'dragging');
  face.style.removeProperty('transform');
  target?.classList.remove('drop-before', 'drop-after');
  gesture = null;
}

function startGesture(target, x, y, source) {
  if (gesture || dialog.open || target.closest('.actions,.subentry,input,.emoji,.check-target,.chevron')) return;
  if (target.matches('textarea:focus')) return;
  const frame = target.closest('[data-item]');
  if (!frame) return;
  const face = frame.querySelector(':scope > .face');
  gesture = { frame, face, x, y, lastX: x, lastY: y, source, mode: 'waiting', moved: false };
  gesture.timer = setTimeout(() => {
    if (!gesture || gesture.mode !== 'waiting') return;
    gesture.mode = 'drag';
    setReveal(null);
    frame.classList.add('dragging');
    gesture.raf = requestAnimationFrame(dragScroll);
  }, 440);
}

function updateDrop() {
  const { frame, lastY, lastX, target } = gesture;
  const entry = locate(frame.dataset.item);
  target?.classList.remove('drop-before', 'drop-after');
  gesture.target = null;
  const under = document.elementFromPoint(lastX, lastY)?.closest(`[data-kind="${frame.dataset.kind}"]`);
  if (!under || under === frame) return;
  const candidate = locate(under.dataset.item);
  if (!candidate || !entry || candidate.list !== entry.list || candidate.item.area !== entry.item.area) return;
  const rect = under.getBoundingClientRect();
  gesture.target = under;
  gesture.after = lastY >= rect.top + rect.height / 2;
  under.classList.add(gesture.after ? 'drop-after' : 'drop-before');
}

function dragScroll() {
  if (gesture?.mode !== 'drag') return;
  const scrollArea = root.querySelector('.shell');
  const { top, bottom, height } = scrollArea.getBoundingClientRect();
  const edge = top + Math.min(108, height / 4);
  const low = bottom - 12;
  const y = gesture.lastY;
  const delta = gesture.moved && (y < edge ? -Math.min(12, (edge - y) / 3) : y > low ? Math.min(12, (y - low) / 3) : 0);
  if (delta) {
    scrollArea.scrollBy(0, delta);
    updateDrop();
  }
  gesture.raf = requestAnimationFrame(dragScroll);
}

function moveGesture(event, x, y) {
  if (!gesture) return;
  const g = gesture;
  g.lastX = x;
  g.lastY = y;
  const dx = x - g.x;
  const dy = y - g.y;
  if (g.mode === 'waiting') {
    if (Math.abs(dx) > 9 && Math.abs(dx) > 1.23 * Math.abs(dy)) {
      clearTimeout(g.timer);
      g.mode = 'swipe';
      setReveal(null);
      g.frame.classList.add('tracking');
    } else if (Math.abs(dy) > 10) {
      stopGesture();
      return;
    }
  }
  if (g.mode === 'swipe') {
    if (event.cancelable) event.preventDefault();
    const left = g.frame.querySelector(':scope > .actions.left');
    const right = g.frame.querySelector(':scope > .actions.right');
    const offset = Math.max(-right.offsetWidth, Math.min(left?.offsetWidth ?? 0, dx));
    g.face.style.transform = `translateX(${offset}px)`;
  } else if (g.mode === 'drag') {
    if (event.cancelable) event.preventDefault();
    g.moved ||= Math.hypot(dx, dy) > 10;
    if (g.moved) updateDrop();
  }
}

function finishGesture(cancelled = false) {
  if (!gesture) return;
  const { mode, frame, x, lastX, target, after, moved, source } = gesture;
  stopGesture();
  if (cancelled || mode === 'waiting') return;
  suppressClickUntil = performance.now() + (source === 'touch' ? 350 : 45);
  if (mode === 'swipe') {
    const dx = lastX - x;
    if (dx < -35) setReveal(frame, 'left');
    else if (dx > 35 && frame.querySelector(':scope > .actions.left')) setReveal(frame, 'right');
  } else if (target && moved) {
    reorder(frame.dataset.item, target.dataset.item, after);
  } else if (!moved) itemMenu(frame.dataset.item);
}

root.addEventListener('touchstart', event => {
  if (event.touches.length !== 1) { stopGesture(); return; }
  const touch = event.touches[0];
  startGesture(event.target, touch.clientX, touch.clientY, 'touch');
}, { passive: true });

document.addEventListener('touchmove', event => {
  if (gesture?.source !== 'touch') return;
  const touch = event.touches[0];
  if (event.touches.length === 1) moveGesture(event, touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener('touchend', () => { if (gesture?.source === 'touch') finishGesture(); });
document.addEventListener('touchcancel', () => { if (gesture?.source === 'touch') finishGesture(true); });

root.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  startGesture(event.target, event.clientX, event.clientY, 'mouse');
});

document.addEventListener('pointermove', event => {
  if (gesture?.source === 'mouse') moveGesture(event, event.clientX, event.clientY);
});

document.addEventListener('pointerup', () => { if (gesture?.source === 'mouse') finishGesture(); });
document.addEventListener('pointercancel', () => { if (gesture?.source === 'mouse') finishGesture(true); });

function trackKeyboardLayout() {
  const visual = window.visualViewport;
  if (!visual) return;
  const page = document.documentElement;
  let fullHeight = root.clientHeight;

  function update() {
    const editor = document.activeElement;
    const editing = editor?.matches('textarea, input:not([type="file"])');
    const wasOpen = page.classList.contains('keyboard-open');
    const open = visual.scale === 1 && (editing || wasOpen) && fullHeight - visual.height > 135;
    page.classList.toggle('keyboard-open', open);
    if (!open) {
      if (!editing) fullHeight = root.clientHeight;
      return;
    }
    page.style.setProperty('--app-full-height', fullHeight + 'px');
    page.style.setProperty('--keyboard-viewport-height', Math.round(visual.height + visual.offsetTop) + 'px');
    if (editor?.matches('.shell textarea') &&
      editor.getBoundingClientRect().bottom > visual.height + visual.offsetTop - 56) {
      editor.scrollIntoView({ block: 'nearest' });
    }
  }

  visual.addEventListener('resize', update);
  visual.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => requestAnimationFrame(update));
  update();
}

(async () => {
  data = await store.load();
  syncDay();
  render();
  setInterval(syncDay, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncDay();
  });
  window.addEventListener('pageshow', syncDay);
  trackKeyboardLayout();
  if (!preview && 'serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Offline-Cache:', error));
  }
})();
