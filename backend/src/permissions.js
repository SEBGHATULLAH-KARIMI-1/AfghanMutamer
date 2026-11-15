export const PERMISSION_SHAPE = {
  dashboard: ['view'],
  pilgrims: ['view', 'create', 'edit', 'delete'],
  payments: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export'],
  employees: ['view', 'create', 'edit', 'delete'],
  expenses: ['view', 'create', 'edit', 'delete'],
  companies: ['view', 'create', 'edit', 'delete'],
  settings: ['view'],
}

// فقط صفحه/عمل‌های شناخته‌شده و فقط مقدار true پذیرفته می‌شود
export function normalizePermissions(p = {}) {
  const out = {}
  for (const [page, actions] of Object.entries(PERMISSION_SHAPE)) {
    out[page] = {}
    for (const a of actions) out[page][a] = p?.[page]?.[a] === true
  }
  return out
}

const allTrue = () => {
  const p = {}
  for (const [page, actions] of Object.entries(PERMISSION_SHAPE)) {
    p[page] = Object.fromEntries(actions.map((a) => [a, true]))
  }
  return p
}

export const DEFAULT_ROLES = [
  { name: 'Admin', label: 'مدیر سیستم', permissions: allTrue() },
  {
    name: 'Accountant', label: 'حسابدار',
    permissions: normalizePermissions({
      dashboard: { view: true }, pilgrims: { view: true },
      payments: { view: true, create: true, edit: true },
      reports: { view: true, export: true }, employees: { view: true },
      expenses: { view: true, create: true, edit: true }, companies: { view: true },
    }),
  },
  {
    name: 'Operator', label: 'اپراتور',
    permissions: normalizePermissions({
      dashboard: { view: true }, pilgrims: { view: true, create: true, edit: true },
      payments: { view: true, create: true }, reports: { view: true },
      expenses: { view: true, create: true }, companies: { view: true },
    }),
  },
  {
    name: 'Guide', label: 'رهنما',
    permissions: normalizePermissions({ dashboard: { view: true }, pilgrims: { view: true } }),
  },
]
