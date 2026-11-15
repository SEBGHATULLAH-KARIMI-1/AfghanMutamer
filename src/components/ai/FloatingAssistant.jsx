import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FiCpu, FiX } from 'react-icons/fi'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import { monthKeyOf, todayISO } from '../../utils/ai/dates'
import { analyzeCustomers, buildDataset } from '../../utils/ai/analytics'
import AssistantChat from './AssistantChat'
import './FloatingAssistant.css'

// داده‌ی دستیار؛ فقط وقتی پنل برای اولین بار باز شود ساخته می‌شود (تا باز نشده هزینه‌ای ندارد)
function ChatPanelBody() {
  const { pilgrims, payments, expenses, companies } = useData()
  const { can } = useAuth()
  const canExpense = can('expenses')
  const today = todayISO()
  const todayKey = monthKeyOf(today)

  const ds = useMemo(
    () => buildDataset({ payments, expenses: canExpense ? expenses : [], pilgrims, companies }),
    [payments, expenses, pilgrims, companies, canExpense],
  )
  const customers = useMemo(
    () => analyzeCustomers({ pilgrims: ds.pilgrims, incomes: ds.incomes, payments: ds.payments, companies: ds.companies, today }),
    [ds, today],
  )
  const ctx = useMemo(
    () => ({ ds, today, todayKey, canIncome: true, canExpense, canCustomers: true, customers: () => customers }),
    [ds, today, todayKey, canExpense, customers],
  )

  return <AssistantChat ctx={ctx} />
}

export default function FloatingAssistant() {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // بعد از اولین باز شدن، پنل مخفی می‌شود ولی گفتگو حفظ می‌ماند

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // دستیار همان دسترسی صفحه‌ی «تحلیل هوشمند» (گزارش‌ها) را لازم دارد
  if (!can('reports', 'view')) return null
  // در خود صفحه‌ی تحلیل هوشمند تب دستیار هست؛ دکمه‌ی تکراری لازم نیست
  if (pathname.startsWith('/ai')) return null

  function toggle() {
    setMounted(true)
    setOpen((v) => !v)
  }

  return (
    <>
      <div className={`ai-float-panel ${open ? 'open' : ''}`} role="dialog" aria-label="دستیار هوشمند" aria-hidden={!open}>
        <div className="ai-float-header">
          <span className="ai-float-icon"><FiCpu /></span>
          <div>
            <div className="ai-float-title">دستیار هوشمند</div>
            <div className="ai-float-sub">درباره‌ی پرداخت‌ها، زائران و مصارف بپرسید</div>
          </div>
          <button className="ai-float-close" onClick={() => setOpen(false)} aria-label="بستن"><FiX /></button>
        </div>
        <div className="ai-float-body">
          {mounted && <ChatPanelBody />}
        </div>
      </div>

      <button
        className={`ai-fab ${open ? 'open' : ''}`}
        onClick={toggle}
        aria-label={open ? 'بستن دستیار هوشمند' : 'باز کردن دستیار هوشمند'}
        title="دستیار هوشمند"
      >
        {open ? <FiX /> : <FiCpu />}
      </button>
    </>
  )
}
