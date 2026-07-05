import { generateId, storage, KEYS } from './storage'
import { todayISO } from './dateUtils'

const FIRST_NAMES_M = ['محمد', 'احمد', 'عبدالله', 'حسین', 'علی', 'یوسف', 'رحیم', 'کریم', 'نجیب', 'فریدون', 'عمر', 'بلال']
const FIRST_NAMES_F = ['فاطمه', 'زهرا', 'مریم', 'عایشه', 'سارا', 'حلیمه', 'نرگس', 'لیلا', 'صدیقه', 'بصیره']
const LAST_NAMES = ['احمدی', 'محمدی', 'کریمی', 'رحیمی', 'یوسفی', 'حسینی', 'نجیبی', 'صافی', 'نوری', 'قادری', 'سلطانی', 'عظیمی']
const FATHER_NAMES = ['غلام حیدر', 'محمد رسول', 'عبدالقادر', 'نور احمد', 'شیر محمد', 'محمد ظاهر', 'عبدالرحیم', 'گل محمد']
const PROVINCES = ['کابل', 'هرات', 'بلخ', 'قندهار', 'ننگرهار', 'بدخشان', 'بامیان', 'غزنی', 'پکتیا', 'کندز']

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randomDateBetween(startYear, endYear) {
  const y = randInt(startYear, endYear)
  const m = randInt(1, 12)
  const d = randInt(1, 28)
  return new Date(y, m - 1, d).toISOString().slice(0, 10)
}

function buildPilgrims(count) {
  const list = []
  for (let i = 0; i < count; i++) {
    const gender = Math.random() > 0.45 ? 'مرد' : 'زن'
    const firstName = gender === 'مرد' ? rand(FIRST_NAMES_M) : rand(FIRST_NAMES_F)
    const travelType = Math.random() > 0.5 ? 'حج' : 'عمره'
    const statusPool = ['تایید شده', 'در انتظار', 'لغو شده']
    list.push({
      id: generateId(),
      fullName: firstName,
      fatherName: rand(FATHER_NAMES),
      lastName: rand(LAST_NAMES),
      gender,
      dob: randomDateBetween(1950, 2000),
      phone: '07' + randInt(0, 9) + randInt(1000000, 9999999),
      address: rand(PROVINCES) + '، افغانستان',
      passportNumber: 'P' + randInt(10000000, 99999999),
      passportIssueDate: randomDateBetween(2018, 2023),
      passportExpiryDate: randomDateBetween(2026, 2031),
      travelType,
      caravanNumber: 'C-' + randInt(100, 130),
      status: rand(statusPool),
      photo: '',
      createdAt: randomDateBetween(2024, 2026),
    })
  }
  return list
}

function buildEmployees() {
  const roles = ['مدیر سیستم', 'حسابدار', 'اپراتور', 'رهنما']
  const names = [
    ['نجیب الله', 'احمدی'],
    ['فریده', 'محمدی'],
    ['عبدالباسط', 'کریمی'],
    ['زرغونه', 'نوری'],
    ['همایون', 'صافی'],
    ['شکریه', 'رحیمی'],
  ]
  return names.map(([fn, ln], idx) => ({
    id: generateId(),
    employeeCode: 'EMP-' + (1001 + idx),
    name: `${fn} ${ln}`,
    position: roles[idx % roles.length],
    phone: '07' + randInt(0, 9) + randInt(1000000, 9999999),
    email: `${fn}.${ln}@hajjumrah.af`.toLowerCase(),
    salary: randInt(8000, 25000),
    joinDate: randomDateBetween(2020, 2025),
    status: 'فعال',
    photo: '',
  }))
}

function buildPayments(pilgrims) {
  const types = ['نقدی', 'بانکی', 'حواله']
  const list = []
  for (let i = 0; i < 40; i++) {
    const pilgrim = rand(pilgrims)
    list.push({
      id: generateId(),
      receiptNumber: 'RC-' + (10000 + i),
      pilgrimId: pilgrim.id,
      pilgrimName: `${pilgrim.fullName} ${pilgrim.lastName}`,
      amount: randInt(5000, 80000),
      paymentType: rand(types),
      date: randomDateBetween(2025, 2026),
      description: pilgrim.travelType === 'حج' ? 'بخشی از هزینه سفر حج' : 'بخشی از هزینه سفر عمره',
      status: rand(['پرداخت شده', 'در انتظار']),
    })
  }
  return list
}

function buildLogs(users) {
  const actions = ['ورود به سیستم', 'افزودن زائر', 'ویرایش زائر', 'حذف زائر', 'افزودن پرداخت', 'ویرایش پرداخت']
  const list = []
  for (let i = 0; i < 25; i++) {
    list.push({
      id: generateId(),
      date: new Date(Date.now() - randInt(0, 20) * 86400000).toISOString(),
      user: rand(users).username,
      action: rand(actions),
      details: 'انجام عملیات سیستمی توسط کاربر',
    })
  }
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
}

function getDefaultRoles() {
  return [
    {
      id: 'role_admin',
      name: 'Admin',
      label: 'مدیر سیستم',
      permissions: {
        dashboard: { view: true },
        pilgrims: { view: true, create: true, edit: true, delete: true },
        payments: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, export: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        settings: { view: true },
      },
    },
    {
      id: 'role_accountant',
      name: 'Accountant',
      label: 'حسابدار',
      permissions: {
        dashboard: { view: true },
        pilgrims: { view: true, create: false, edit: false, delete: false },
        payments: { view: true, create: true, edit: true, delete: false },
        reports: { view: true, export: true },
        employees: { view: true, create: false, edit: false, delete: false },
        expenses: { view: true, create: true, edit: true, delete: false },
        settings: { view: false },
      },
    },
    {
      id: 'role_operator',
      name: 'Operator',
      label: 'اپراتور',
      permissions: {
        dashboard: { view: true },
        pilgrims: { view: true, create: true, edit: true, delete: false },
        payments: { view: true, create: true, edit: false, delete: false },
        reports: { view: true, export: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: true, create: true, edit: false, delete: false },
        settings: { view: false },
      },
    },
    {
      id: 'role_guide',
      name: 'Guide',
      label: 'رهنما',
      permissions: {
        dashboard: { view: true },
        pilgrims: { view: true, create: false, edit: false, delete: false },
        payments: { view: false, create: false, edit: false, delete: false },
        reports: { view: false, export: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        settings: { view: false },
      },
    },
  ]
}

export function seedIfEmpty() {
  if (storage.get(KEYS.SEEDED, false)) {
    if (!storage.get(KEYS.ROLES, null)) {
      storage.set(KEYS.ROLES, getDefaultRoles())
    }
    return
  }

  const users = [
    { id: generateId(), username: 'admin', password: 'admin123', name: 'مدیر سیستم', role: 'Admin' },
    { id: generateId(), username: 'accountant', password: 'acc123', name: 'حسابدار شرکت', role: 'Accountant' },
  ]

  const pilgrims = buildPilgrims(48)
  const employees = buildEmployees()
  const payments = buildPayments(pilgrims)
  const logs = buildLogs(users)

  const settings = {
    companyName: 'شرکت خدمات حج و عمره الفردوس',
    logo: '',
    address: 'کابل، افغانستان - شهرک امنیت ملی',
    phone: '+93 70 000 0000',
    email: 'info@alferdows-hajj.af',
    language: 'fa',
    theme: 'light',
  }

  storage.set(KEYS.USERS, users)
  storage.set(KEYS.ROLES, getDefaultRoles())
  storage.set(KEYS.PILGRIMS, pilgrims)
  storage.set(KEYS.EMPLOYEES, employees)
  storage.set(KEYS.PAYMENTS, payments)
  storage.set(KEYS.LOGS, logs)
  storage.set(KEYS.SETTINGS, settings)
  storage.set(KEYS.SEEDED, true)
}
