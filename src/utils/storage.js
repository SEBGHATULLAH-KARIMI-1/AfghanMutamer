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
  EXPENSES: 'hums_expenses',
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
    // نشست ورود (AUTH) در پشتیبان نیامده تا بازیابی کسی را به جای کاربر دیگر وارد نکند
    const backup = {}
    Object.values(KEYS).forEach((k) => {
      if (k === KEYS.AUTH) return
      backup[k] = read(k, null)
    })
    return backup
  },
  restoreBackup(backup) {
    if (!backup || typeof backup !== 'object' || Array.isArray(backup)) throw new Error('invalid-backup')
    const listKeys = [KEYS.PILGRIMS, KEYS.PAYMENTS, KEYS.EMPLOYEES, KEYS.LOGS, KEYS.USERS, KEYS.ROLES, KEYS.COMPANIES, KEYS.EXPENSES]
    let restored = 0
    // فقط کلیدهای شناخته‌شده‌ی برنامه بازیابی می‌شوند و نشست ورود هرگز
    Object.values(KEYS).forEach((k) => {
      if (k === KEYS.AUTH) return
      const v = backup[k]
      if (v === null || v === undefined) return
      if (listKeys.includes(k) && !Array.isArray(v)) return
      if ((k === KEYS.USERS || k === KEYS.ROLES) && v.length === 0) return // جلوگیری از قفل شدن سیستم
      if (k === KEYS.SETTINGS && (typeof v !== 'object' || Array.isArray(v))) return
      if (k === KEYS.THEME && v !== 'light' && v !== 'dark') return
      if (write(k, v)) restored += 1
    })
    if (restored === 0) throw new Error('empty-backup')
    return restored
  },
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export { KEYS }
