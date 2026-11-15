import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, apiErrorMessage } from '../utils/api'
import { generateId } from '../utils/storage'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const DataContext = createContext(null)

const PATHS = {
  pilgrims: '/pilgrims',
  payments: '/payments',
  employees: '/employees',
  companies: '/companies',
  expenses: '/expenses',
}

// سرور برای مقدار خالی null می‌دهد؛ فرم‌ها و داده‌های قبلی برنامه از '' استفاده می‌کردند
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? '' : v]))
const cleanList = (l) => (Array.isArray(l) ? l.map(clean) : [])

export function DataProvider({ children }) {
  const [pilgrims, setPilgrims] = useState([])
  const [payments, setPayments] = useState([])
  const [employees, setEmployees] = useState([])
  const [companies, setCompanies] = useState([])
  const [expenses, setExpenses] = useState([])
  const [logs, setLogs] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(false)

  const { user } = useAuth()
  const { showToast } = useToast()
  const userId = user?.id

  const SET = useMemo(
    () => ({ pilgrims: setPilgrims, payments: setPayments, employees: setEmployees, companies: setCompanies, expenses: setExpenses }),
    [],
  )

  // ───────── خواندن از سرور ─────────
  const loadOne = useCallback(async (key) => {
    try {
      if (key === 'logs') setLogs(await api('/logs'))
      else if (key === 'settings') setSettings(await api('/settings'))
      else SET[key](cleanList(await api(PATHS[key])))
    } catch (e) {
      // ۴۰۳ یعنی این نقش به آن بخش دسترسی ندارد؛ خطا نیست
      if (e.status !== 403 && e.status !== 401) showToast(apiErrorMessage(e), 'error')
    }
  }, [SET, showToast])

  const loadAll = useCallback(
    () => Promise.all([...Object.keys(PATHS), 'settings', 'logs'].map(loadOne)),
    [loadOne],
  )

  useEffect(() => {
    if (!userId) {
      setPilgrims([]); setPayments([]); setEmployees([]); setCompanies([]); setExpenses([]); setLogs([]); setSettings({})
      return undefined
    }
    let alive = true
    setLoading(true)
    loadAll().finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [userId, loadAll])

  // ───────── نوشتن روی سرور ─────────
  // تغییرات بلافاصله در صفحه دیده می‌شود و پشت صف به سرور می‌رود (ترتیب حفظ می‌شود: مثلاً اول زائر، بعد پرداخت او).
  // اگر سرور رد کرد، پیام خطا نشان داده و وضعیت از سرور دوباره خوانده می‌شود.
  const queue = useRef(Promise.resolve())
  const logTimer = useRef(null)

  const scheduleLogs = useCallback(() => {
    clearTimeout(logTimer.current)
    logTimer.current = setTimeout(() => loadOne('logs'), 800)
  }, [loadOne])

  const enqueue = useCallback((task, onFail) => {
    queue.current = queue.current
      .then(task)
      .then(scheduleLogs)
      .catch((e) => {
        showToast(apiErrorMessage(e), 'error')
        onFail?.()
      })
  }, [scheduleLogs, showToast])

  function makeCrud(key, { afterUpdate, afterDelete } = {}) {
    const set = SET[key]
    const path = PATHS[key]
    return {
      add(data) {
        const item = { ...data, id: generateId() }
        set((l) => [item, ...l])
        enqueue(async () => {
          const saved = clean(await api(path, { method: 'POST', body: item }))
          set((l) => l.map((x) => (x.id === item.id ? saved : x)))
        }, () => set((l) => l.filter((x) => x.id !== item.id)))
        return item
      },
      update(id, patch) {
        set((l) => l.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x)))
        enqueue(async () => {
          const saved = clean(await api(`${path}/${id}`, { method: 'PUT', body: patch }))
          set((l) => l.map((x) => (String(x.id) === String(id) ? saved : x)))
          afterUpdate?.(patch)
        }, () => loadOne(key))
      },
      remove(id) {
        set((l) => l.filter((x) => String(x.id) !== String(id)))
        enqueue(async () => {
          await api(`${path}/${id}`, { method: 'DELETE' })
          afterDelete?.(id)
        }, () => loadOne(key))
      },
    }
  }

  const pilgrimCrud = makeCrud('pilgrims', {
    // نام زائر در پرداخت‌ها ذخیره است و سرور آن را هماهنگ می‌کند؛ اینجا فقط دوباره می‌خوانیم
    afterUpdate: (patch) => { if ('fullName' in patch || 'lastName' in patch) loadOne('payments') },
    afterDelete: () => loadOne('payments'),
  })
  const paymentCrud = makeCrud('payments')
  const employeeCrud = makeCrud('employees')
  const expenseCrud = makeCrud('expenses')
  const companyCrud = makeCrud('companies', {
    afterDelete: () => loadOne('pilgrims'),
  })

  function deleteCompany(id) {
    // زائران شرکت حذف‌شده نمی‌مانند حذف شوند؛ فقط از شرکت جدا می‌شوند
    setPilgrims((l) => l.map((p) => (p.companyId === id ? { ...p, companyId: '' } : p)))
    companyCrud.remove(id)
  }

  function updateSettings(patch) {
    setSettings((s) => ({ ...s, ...patch }))
    enqueue(async () => {
      setSettings(await api('/settings', { method: 'PUT', body: patch }))
    }, () => loadOne('settings'))
  }

  function refreshAll() {
    return loadAll()
  }

  const value = {
    pilgrims, addPilgrim: pilgrimCrud.add, updatePilgrim: pilgrimCrud.update, deletePilgrim: pilgrimCrud.remove,
    payments, addPayment: paymentCrud.add, updatePayment: paymentCrud.update, deletePayment: paymentCrud.remove,
    employees, addEmployee: employeeCrud.add, updateEmployee: employeeCrud.update, deleteEmployee: employeeCrud.remove,
    companies, addCompany: companyCrud.add, updateCompany: companyCrud.update, deleteCompany,
    expenses, addExpense: expenseCrud.add, updateExpense: expenseCrud.update, deleteExpense: expenseCrud.remove,
    logs, settings, updateSettings, refreshAll, loading,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
