// سرویس مدیریت ذخیره‌سازی محلی (LocalStorage Database)

const KEYS = {
  PILGRIMS: 'hums_pilgrims',
  PAYMENTS: 'hums_payments',
  EMPLOYEES: 'hums_employees',
  LOGS: 'hums_logs',
  SETTINGS: 'hums_settings',
  USERS: 'hums_users',
  AUTH: 'hums_auth',
  THEME: 'hums_theme',
  ROLES: 'hums_roles',
  SEEDED: 'hums_seeded_v1',
  COMPANIES: 'hums_companies',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.error('خطا در خواندن از حافظه محلی:', e)
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('خطا در نوشتن در حافظه محلی:', e)
    return false
  }
}

export const storage = {
  KEYS,
  get: read,
  set: write,
  remove(key) {
    localStorage.removeItem(key)
  },

  // CRUD عمومی برای آرایه‌های ذخیره شده در یک کلید
  getAll(key) {
    return read(key, [])
  },
  saveAll(key, list) {
    return write(key, list)
  },
  add(key, item) {
    const list = read(key, [])
    const newItem = { ...item, id: item.id || generateId() }
    list.unshift(newItem)
    write(key, list)
    return newItem
  },
  update(key, id, patch) {
    const list = read(key, [])
    const idx = list.findIndex((i) => String(i.id) === String(id))
    if (idx === -1) return null
    list[idx] = { ...list[idx], ...patch }
    write(key, list)
    return list[idx]
  },
  removeItem(key, id) {
    const list = read(key, [])
    const filtered = list.filter((i) => String(i.id) !== String(id))
    write(key, filtered)
    return filtered
  },

  exportBackup() {
    const backup = {}
    Object.values(KEYS).forEach((k) => {
      backup[k] = read(k, null)
    })
    return backup
  },
  restoreBackup(backup) {
    Object.entries(backup).forEach(([k, v]) => {
      if (v !== null && v !== undefined) write(k, v)
    })
  },
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export { KEYS }
