import { createContext, useContext, useState } from 'react'
import { storage, KEYS, generateId } from '../utils/storage'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [pilgrims, setPilgrims] = useState(() => storage.getAll(KEYS.PILGRIMS))
  const [payments, setPayments] = useState(() => storage.getAll(KEYS.PAYMENTS))
  const [employees, setEmployees] = useState(() => storage.getAll(KEYS.EMPLOYEES))
  const [logs, setLogs] = useState(() => storage.getAll(KEYS.LOGS))
  const [settings, setSettings] = useState(() => storage.get(KEYS.SETTINGS, {}))

  const auth = useAuth()

  function writeLog(action, details) {
    const username = auth?.user?.username || 'system'
    const newLogs = [
      { id: generateId(), date: new Date().toISOString(), user: username, action, details },
      ...storage.getAll(KEYS.LOGS),
    ]
    storage.saveAll(KEYS.LOGS, newLogs)
    setLogs(newLogs)
  }

  // ---------- Pilgrims ----------
  function addPilgrim(data) {
    const item = storage.add(KEYS.PILGRIMS, data)
    setPilgrims(storage.getAll(KEYS.PILGRIMS))
    writeLog('افزودن زائر', `زائر "${data.fullName} ${data.lastName}" اضافه شد`)
    return item
  }
  function updatePilgrim(id, patch) {
    storage.update(KEYS.PILGRIMS, id, patch)
    setPilgrims(storage.getAll(KEYS.PILGRIMS))
    writeLog('ویرایش زائر', `اطلاعات زائر ویرایش شد (ID: ${id})`)
  }
  function deletePilgrim(id) {
    storage.removeItem(KEYS.PILGRIMS, id)
    setPilgrims(storage.getAll(KEYS.PILGRIMS))
    writeLog('حذف زائر', `زائر حذف شد (ID: ${id})`)
  }

  // ---------- Payments ----------
  function addPayment(data) {
    const item = storage.add(KEYS.PAYMENTS, data)
    setPayments(storage.getAll(KEYS.PAYMENTS))
    writeLog('افزودن پرداخت', `پرداخت "${data.receiptNumber}" ثبت شد`)
    return item
  }
  function updatePayment(id, patch) {
    storage.update(KEYS.PAYMENTS, id, patch)
    setPayments(storage.getAll(KEYS.PAYMENTS))
    writeLog('ویرایش پرداخت', `پرداخت ویرایش شد (ID: ${id})`)
  }
  function deletePayment(id) {
    storage.removeItem(KEYS.PAYMENTS, id)
    setPayments(storage.getAll(KEYS.PAYMENTS))
    writeLog('حذف پرداخت', `پرداخت حذف شد (ID: ${id})`)
  }

  // ---------- Employees ----------
  function addEmployee(data) {
    const item = storage.add(KEYS.EMPLOYEES, data)
    setEmployees(storage.getAll(KEYS.EMPLOYEES))
    writeLog('افزودن کارمند', `کارمند "${data.name}" اضافه شد`)
    return item
  }
  function updateEmployee(id, patch) {
    storage.update(KEYS.EMPLOYEES, id, patch)
    setEmployees(storage.getAll(KEYS.EMPLOYEES))
    writeLog('ویرایش کارمند', `اطلاعات کارمند ویرایش شد (ID: ${id})`)
  }
  function deleteEmployee(id) {
    storage.removeItem(KEYS.EMPLOYEES, id)
    setEmployees(storage.getAll(KEYS.EMPLOYEES))
    writeLog('حذف کارمند', `کارمند حذف شد (ID: ${id})`)
  }

  // ---------- Settings ----------
  function updateSettings(patch) {
    const newSettings = { ...settings, ...patch }
    storage.set(KEYS.SETTINGS, newSettings)
    setSettings(newSettings)
    writeLog('بروزرسانی تنظیمات', 'تنظیمات سیستم بروزرسانی شد')
  }

  function refreshAll() {
    setPilgrims(storage.getAll(KEYS.PILGRIMS))
    setPayments(storage.getAll(KEYS.PAYMENTS))
    setEmployees(storage.getAll(KEYS.EMPLOYEES))
    setLogs(storage.getAll(KEYS.LOGS))
    setSettings(storage.get(KEYS.SETTINGS, {}))
  }

  const value = {
    pilgrims, addPilgrim, updatePilgrim, deletePilgrim,
    payments, addPayment, updatePayment, deletePayment,
    employees, addEmployee, updateEmployee, deleteEmployee,
    logs, settings, updateSettings, refreshAll,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
