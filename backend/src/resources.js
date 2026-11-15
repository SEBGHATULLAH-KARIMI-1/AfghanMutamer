import { HttpError } from './util.js'

const PILGRIM_STATUSES = ['در انتظار', 'تایید شده', 'لغو شده']
const PAYMENT_STATUSES = ['پرداخت شده', 'در انتظار']
const bad = (m) => { throw new HttpError(400, m) }

export const RESOURCES = {
  companies: {
    table: 'companies', label: 'شرکت', perm: 'companies',
    readPages: ['companies', 'pilgrims', 'payments', 'dashboard', 'reports'],
    columns: { name: 'text', phone: 'text', address: 'text', email: 'text', contactPerson: 'text' },
    describe: (d) => d.name,
    validate(d) {
      if (!d.name) bad('نام شرکت الزامی است')
      if (d.phone && d.phone.replace(/\D/g, '').length < 7) bad('شماره تماس معتبر نیست')
      if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) bad('ایمیل معتبر نیست')
    },
  },

  pilgrims: {
    table: 'pilgrims', label: 'زائر', perm: 'pilgrims',
    readPages: ['pilgrims', 'payments', 'companies', 'dashboard', 'reports'],
    columns: {
      fullName: 'text', fatherName: 'text', lastName: 'text', gender: 'text', dob: 'date',
      phone: 'text', address: 'text', passportNumber: 'text', passportIssueDate: 'date',
      passportExpiryDate: 'date', travelType: 'text', caravanNumber: 'text', status: 'text',
      photo: 'text', familyGroup: 'text', packagePrice: 'number', currency: 'currency',
      finalPrice: 'number', stayDuration: 'int', companyId: 'ref', createdAt: 'date',
    },
    describe: (d) => `${d.fullName} ${d.lastName}`.trim(),
    validate(d) {
      if (!d.fullName) bad('نام الزامی است')
      if (!d.lastName) bad('نام خانوادگی الزامی است')
      if (d.status && !PILGRIM_STATUSES.includes(d.status)) bad('وضعیت زائر نامعتبر است')
      if (d.packagePrice != null && d.packagePrice < 0) bad('قیمت بسته نمی‌تواند منفی باشد')
      if (d.finalPrice != null && d.finalPrice < 0) bad('قیمت تمام‌شده نمی‌تواند منفی باشد')
    },
    // نام زائر در پرداخت‌ها هم ذخیره است؛ با تغییر نام هماهنگ می‌شود
    prepare(_client, patch) {
      if (patch.createdAt == null) delete patch.createdAt // خالی = مقدار پیش‌فرض (امروز)
    },
    async afterWrite(client, before, after) {
      if (before && (before.fullName !== after.fullName || before.lastName !== after.lastName)) {
        await client.query('update payments set pilgrim_name = $1 where pilgrim_id = $2',
          [`${after.fullName} ${after.lastName}`.trim(), after.id])
      }
    },
  },

  payments: {
    table: 'payments', label: 'پرداخت', perm: 'payments',
    readPages: ['payments', 'reports'],
    columns: {
      receiptNumber: 'text', pilgrimId: 'ref', pilgrimName: 'text', amount: 'number',
      paymentType: 'text', date: 'date', description: 'text', status: 'text',
      currency: 'currency', exchangeRate: 'number', usdAmount: 'number',
    },
    describe: (d) => d.receiptNumber,
    validate(d, before) {
      if (!before && !d.pilgrimId) bad('انتخاب زائر الزامی است')
      if (!(Number(d.amount) > 0)) bad('مبلغ معتبر وارد کنید')
      if (!d.date) bad('تاریخ الزامی است')
      if (d.exchangeRate != null && !(d.exchangeRate > 0)) bad('نرخ برابری معتبر نیست')
      // فقط وقتی وضعیت تازه می‌آید یا عوض می‌شود بررسی می‌شود (فیش‌های قدیمی با وضعیت متفاوت قفل نمی‌شوند)
      if (d.status && (!before || d.status !== before.status) && !PAYMENT_STATUSES.includes(d.status)) bad('وضعیت پرداخت نامعتبر است')
    },
    async prepare(client, patch, before) {
      // نام زائر، شماره فیش (اگر خالی باشد) و معادل دالری سمت سرور محاسبه می‌شود
      if (patch.pilgrimId) {
        const { rows } = await client.query('select full_name, last_name from pilgrims where id = $1', [patch.pilgrimId])
        if (!rows[0]) bad('زائر انتخاب‌شده یافت نشد')
        patch.pilgrimName = `${rows[0].full_name} ${rows[0].last_name}`.trim()
      } else if (before) {
        delete patch.pilgrimId
        delete patch.pilgrimName
      }
      if (!patch.receiptNumber) {
        if (before) delete patch.receiptNumber
        else {
          const { rows } = await client.query("select nextval('receipt_seq') as n")
          patch.receiptNumber = `RC-${rows[0].n}`
        }
      }
      const full = { ...(before ?? {}), ...patch }

      // پرداخت به ارزی غیر از ارز بستهٔ زائر بدون نرخ برابری قابل تبدیل نیست.
      // نرخ ننوشته باشد و قبلاً نرخی ثبت شده باشد، آخرین نرخ همین‌حال روی همان فیش ثبت می‌شود
      // (تا با عوض‌شدن نرخ‌ها حساب قدیمی جابه‌جا نشود). ویرایش فیشهای قدیمی که مبلغ/ارز/زائرشان عوض نمی‌شود بلامانع است.
      const touched = !before
        || patch.currency !== before.currency
        || Number(patch.amount) !== Number(before.amount)
        || (patch.pilgrimId && patch.pilgrimId !== before.pilgrimId)
      if (touched && full.pilgrimId && !(Number(full.exchangeRate) > 0)) {
        const { rows: pr } = await client.query('select package_price, currency from pilgrims where id = $1', [full.pilgrimId])
        const pg = pr[0]
        if (pg && Number(pg.package_price) > 0 && (pg.currency || 'افغانی') !== (full.currency || 'افغانی')) {
          const { rows: rr } = await client.query(
            'select exchange_rate from payments where exchange_rate > 0 order by "date" desc, seq desc limit 1',
          )
          if (!rr[0]) bad('ارز پرداخت با ارز بسته فرق دارد؛ نرخ برابری را وارد کنید')
          patch.exchangeRate = Number(rr[0].exchange_rate)
          full.exchangeRate = patch.exchangeRate
        }
      }
      const rate = Number(full.exchangeRate)
      patch.usdAmount = full.currency === 'دالر' ? Number(full.amount) : rate > 0 ? Number(full.amount) / rate : null
    },
  },

  employees: {
    table: 'employees', label: 'کارمند', perm: 'employees',
    columns: {
      employeeCode: 'text', name: 'text', position: 'text', phone: 'text', email: 'text',
      salary: 'number', currency: 'currency', joinDate: 'date', status: 'text', photo: 'text',
    },
    describe: (d) => d.name,
    validate(d) {
      if (!d.name) bad('نام کارمند الزامی است')
      if (d.salary != null && d.salary < 0) bad('معاش نمی‌تواند منفی باشد')
    },
  },

  expenses: {
    table: 'expenses', label: 'مصرف', perm: 'expenses',
    columns: {
      date: 'date', type: 'text', category: 'text', person: 'text',
      amount: 'number', description: 'text', currency: 'currency',
    },
    describe: (d) => d.description || d.category,
    validate(d) {
      if (!(Number(d.amount) > 0)) bad('مبلغ معتبر وارد کنید')
      if (!d.date) bad('تاریخ الزامی است')
      if (!d.description) bad('توضیح الزامی است')
    },
  },
}
