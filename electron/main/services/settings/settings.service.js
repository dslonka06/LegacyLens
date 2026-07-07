const { getDatabase } = require('../../database/database');

const DEFAULTS = {
  theme: 'dark',
  aiProvider: null,
  aiModel: null,
  defaultExportPath: null,
};

class SettingsService {

  /**
   * Gets a setting value. Returns the default if no value has been saved.
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    const row = getDatabase()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key);

    if (row) return JSON.parse(row.value);
    return DEFAULTS[key] ?? null;
  }

  /**
   * Sets a setting value.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    getDatabase().prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
  }

  /**
   * Returns all settings merged with defaults.
   * @returns {Record<string, any>}
   */
  getAll() {
    const rows = getDatabase().prepare('SELECT key, value FROM settings').all();
    const stored = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
    return { ...DEFAULTS, ...stored };
  }

  /**
   * Deletes a setting, reverting it to the default.
   * @param {string} key
   */
  delete(key) {
    getDatabase().prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

module.exports = { SettingsService };
