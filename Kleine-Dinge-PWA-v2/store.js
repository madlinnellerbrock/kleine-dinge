const store = (() => {
  const databaseName = document.documentElement.hasAttribute('data-preview') ? 'kleine-dinge-vorschau' : 'kleine-dinge';
  const backupKey = databaseName + '-fallback';
  const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(36).slice(2);
  let db;
  let queue = Promise.resolve();

  function today(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function fresh() {
    return {
      version: 2,
      tasks: [],
      categories: [
        ['🌷', 'Mein ideales Ich'], ['☕', 'Mein idealer Alltag'],
        ['🎨', 'Hobbys & Interessen'], ['🌱', 'Wachsen & Verändern']
      ].map(([emoji, title]) => ({ id: uid(), emoji, title, cards: [] }))
    };
  }

  function normalize(input) {
    if (![1, 2].includes(input?.version) || !Array.isArray(input.tasks) || !Array.isArray(input.categories)) {
      throw new Error('Ungültiges Backup-Format');
    }
    const ids = new Set();

    function item(value, field) {
      if (typeof value?.id !== 'string' || !value.id || ids.has(value.id) || typeof value[field] !== 'string') {
        throw new Error('Ungültige oder doppelte Einträge im Backup');
      }
      ids.add(value.id);
      return { id: value.id, [field]: value[field] };
    }

    const emoji = value => typeof value === 'string' && value ? value : '🪴';
    return {
      version: 2,
      savedAt: Number.isFinite(input.savedAt) ? input.savedAt : 0,
      tasks: input.tasks.map(task => {
        const base = item(task, 'text');
        if (!['today', 'someday'].includes(task.area) || !Array.isArray(task.children)) {
          throw new Error('Ungültige Aufgabe im Backup');
        }
        return {
          ...base, emoji: emoji(task.emoji), area: task.area,
          day: typeof task.day === 'string' ? task.day : null,
          done: task.done === true, collapsed: task.collapsed === true,
          children: task.children.map(child => ({ ...item(child, 'text'), done: child.done === true }))
        };
      }),
      categories: input.categories.map(category => {
        const base = item(category, 'title');
        if (!Array.isArray(category.cards)) throw new Error('Ungültige Kategorie im Backup');
        return { ...base, emoji: emoji(category.emoji), cards: category.cards.map(card => ({
          ...item(card, 'text'), emoji: emoji(card.emoji)
        })) };
      })
    };
  }

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('store');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Datenspeicher ist blockiert'));
    });
  }

  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', mode);
      const request = action(tx.objectStore('store'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function load() {
    let mirror;
    let indexed;
    try { mirror = normalize(JSON.parse(localStorage.getItem(backupKey))); } catch {}
    try {
      db = await open();
      const result = await transaction('readonly', table => table.get('data'));
      if (result) indexed = normalize(result);
    } catch {}
    if (indexed && (indexed.savedAt >= (mirror?.savedAt ?? 0))) return indexed;
    return mirror ?? fresh();
  }

  function save(data) {
    data.savedAt = Math.max(Date.now(), (data.savedAt ?? 0) + 1);
    const json = JSON.stringify(data);
    let mirrored = false;
    try {
      localStorage.setItem(backupKey, json);
      mirrored = true;
    } catch {}
    const write = queue.then(async () => {
      if (db) {
        try {
          await transaction('readwrite', table => table.put(JSON.parse(json), 'data'));
          return;
        } catch (error) {
          if (!mirrored) throw error;
        }
      }
      if (!mirrored) throw new Error('Lokales Speichern ist nicht verfügbar');
    });
    queue = write.catch(() => {});
    return write;
  }

  return { fresh, load, normalize, save, today, uid };
})();
