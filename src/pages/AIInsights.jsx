import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import {
  FiCpu, FiAlertTriangle, FiTrendingUp, FiUsers, FiPercent, FiShoppingCart, FiCheckCircle, FiInfo,
} from 'react-icons/fi'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/common/StatCard'
import EmptyState from '../components/common/EmptyState'
import { SkeletonCards } from '../components/common/Skeleton'
import ForecastChart from '../components/ai/ForecastChart'
import AssistantChat from '../components/ai/AssistantChat'
import { formatJalali, formatNumber, toPersianDigits } from '../utils/dateUtils'
import { monthKeyOf, monthLabel, todayISO } from '../utils/ai/dates'
import {
  CONFIDENCE_LABEL, CURRENCIES, METHOD_LABEL, SEGMENT_COLOR, SEGMENT_LABEL, analyzeCustomers, buildDataset,
  buildForecast, buildInsights, categoryBreakdown, categorySpikes, curLabel, findAnomalies, findDuplicates,
  monthlyMap, money, pct, sumByCurrency, topPayers,
} from '../utils/ai/analytics'
import { normalizeText, parsePeriod } from '../utils/ai/assistant'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const TABS = [
  { id: 'overview', label: 'خلاصه هوشمند' },
  { id: 'revenue', label: 'درآمد و پیش‌بینی' },
  { id: 'customers', label: 'تحلیل مشتریان' },
  { id: 'expenses', label: 'تحلیل مصارف' },
  { id: 'assistant', label: 'دستیار هوشمند' },
]

const EXP_PERIODS = [
  { id: 'month', label: 'این ماه', q: 'این ماه' },
  { id: '3m', label: '۳ ماه اخیر', q: 'سه ماه اخیر' },
  { id: 'year', label: 'امسال', q: 'امسال' },
  { id: 'all', label: 'کل دوران', q: 'همه' },
]

const PALETTE = ['#0F5132', '#D4AF37', '#2b6cc0', '#c0392b', '#7d3c98', '#16a085', '#e67e22', '#566573', '#a93226', '#1d8a4e', '#8a6508']

const INSIGHT_ICON = {
  danger: <FiAlertTriangle />, warn: <FiAlertTriangle />, good: <FiCheckCircle />, info: <FiInfo />,
}

function Insights({ list }) {
  if (!list.length) {
    return <EmptyState title="هنوز نکته‌ای برای نمایش نیست" description="با ثبت پرداخت‌ها و مصارف بیشتر، تحلیل هوشمند فعال می‌شود." />
  }
  return (
    <div className="ai-insights">
      {list.map((i, idx) => (
        <div key={idx} className={`ai-insight ${i.type}`}>
          <span className="ai-insight-icon">{INSIGHT_ICON[i.type]}</span>
          <div>
            <div className="fw-bold" style={{ fontSize: 13.5 }}>{i.title}</div>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.8 }}>{i.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniTable({ columns, rows, empty = 'موردی وجود ندارد' }) {
  if (!rows.length) return <div className="card-body text-muted" style={{ fontSize: 13 }}>{empty}</div>
  return (
    <div className="table-wrapper">
      <table className="data-table ai-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function ForecastCard({ title, list, cur, todayKey, color, hint }) {
  const { series, forecast } = useMemo(() => buildForecast(list, cur, todayKey, 4), [list, cur, todayKey])
  const label = curLabel(cur)
  return (
    <div className="card">
      <div className="card-header"><h3>{title} ({label})</h3></div>
      {series.length === 0 ? (
        <EmptyState title="داده‌ای برای این ارز وجود ندارد" />
      ) : (
        <>
          <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}>
            <ForecastChart series={series} forecast={forecast} name={label} color={color} />
          </div>
          {forecast ? (
            <>
              <MiniTable
                columns={['ماه', 'برآورد', 'بازه‌ی محتمل (≈۸۰٪)']}
                rows={forecast.points.map((p) => [p.label, money(p.value, cur), `${money(p.low, cur)} تا ${money(p.high, cur)}`])}
              />
              <div className="card-body text-muted" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                روش: {METHOD_LABEL[forecast.method]} ({toPersianDigits(forecast.n)} ماه کامل) — اطمینان {CONFIDENCE_LABEL[forecast.confidence]}.
                {forecast.trendPct != null && ` روند سه ماه اخیر نسبت به سه ماه قبل: ${forecast.trendPct >= 0 ? '+' : '−'}${pct(Math.abs(forecast.trendPct))}.`}
                {' '}{hint} نقطه‌ی توخالی، ماه جاری (ناقص) است.
              </div>
            </>
          ) : (
            <div className="card-body text-muted" style={{ fontSize: 13 }}>
              برای پیش‌بینی حداقل سه ماه کامل داده لازم است. با گذشت زمان و ثبت داده‌ی بیشتر، پیش‌بینی فعال می‌شود.
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AIInsights() {
  const { pilgrims, payments, expenses, companies, settings, loading } = useData()
  const { can } = useAuth()
  const [tab, setTab] = useState('overview')
  const [curState, setCur] = useState(null)
  const [expPeriodId, setExpPeriodId] = useState('3m')

  // دسترسی به گزارش‌ها = خواندن پرداخت‌ها و زائران؛ مصارف جداگانه کنترل می‌شود (مثل سرور)
  const canIncome = true
  const canCustomers = true
  const canExpense = can('expenses')

  const cur = curState || (settings.displayCurrency === 'افغانی' ? 'afn' : 'usd')
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
  const insights = useMemo(
    () => buildInsights(ds, { todayKey, today, canIncome, canExpense, canCustomers }),
    [ds, todayKey, today, canExpense],
  )
  const chatCtx = useMemo(
    () => ({ ds, today, todayKey, canIncome, canExpense, canCustomers, customers: () => customers }),
    [ds, today, todayKey, canExpense, customers],
  )

  const expPeriod = useMemo(
    () => parsePeriod(normalizeText(EXP_PERIODS.find((p) => p.id === expPeriodId).q), today),
    [expPeriodId, today],
  )
  const expSums = useMemo(() => sumByCurrency(ds.costs, expPeriod), [ds, expPeriod])
  const cats = useMemo(() => categoryBreakdown(ds.costs, expPeriod, cur), [ds, expPeriod, cur])
  const anomalies = useMemo(() => findAnomalies(ds.costs).filter((a) => a.expense._k === cur).slice(0, 8), [ds, cur])
  const duplicates = useMemo(() => findDuplicates(ds.costs).filter((g) => g[0]._k === cur), [ds, cur])
  const spikes = useMemo(() => categorySpikes(ds.costs, cur, todayKey), [ds, cur, todayKey])

  // درآمد در برابر مصارف، ۶ ماه اخیر
  const incVsExp = useMemo(() => {
    const keys = []
    for (let k = todayKey - 5; k <= todayKey; k += 1) keys.push(k)
    const im = monthlyMap(ds.incomes)
    const em = monthlyMap(ds.costs)
    return {
      labels: keys.map(monthLabel),
      inc: keys.map((k) => Math.round(im.get(k)?.[cur] || 0)),
      exp: keys.map((k) => Math.round(em.get(k)?.[cur] || 0)),
    }
  }, [ds, todayKey, cur])

  const incomeTypes = useMemo(() => {
    const map = new Map()
    ds.incomes.filter((p) => p._k === cur).forEach((p) => {
      const n = p.paymentType || 'نامشخص'
      const c = map.get(n) || { name: n, sum: 0, count: 0 }
      c.sum += p._a; c.count += 1; map.set(n, c)
    })
    return [...map.values()].sort((a, b) => b.sum - a.sum)
  }, [ds, cur])

  if (loading) return <SkeletonCards count={4} />

  const cs = customers.perCur[cur]
  const incFc = buildForecast(ds.incomes, cur, todayKey, 3).forecast
  const nextIncome = incFc?.points.find((p) => p.key === todayKey + 1)
  const urgent = insights.filter((i) => i.type === 'danger' || i.type === 'warn').length
  const followUp = customers.segments.stalled + customers.segments.nopay

  const barOpts = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } } },
  }

  return (
    <div>
      <div className="ai-hero">
        <span className="ai-hero-icon"><FiCpu /></span>
        <div>
          <div className="fw-bold" style={{ fontSize: 16 }}>تحلیل هوشمند</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>
            تحلیل فروش، پیش‌بینی، مشتریان و مصارف — همه از داده‌های واقعی خود شما، روی همین سیستم
          </div>
        </div>
        <div className="chip-group" style={{ marginInlineStart: 'auto' }}>
          {CURRENCIES.map((k) => (
            <button key={k} className={`chip ${cur === k ? 'active' : ''}`} onClick={() => setCur(k)}>{curLabel(k)}</button>
          ))}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ───────── خلاصه ───────── */}
      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            <StatCard icon={<FiAlertTriangle />} label="هشدارهای نیازمند توجه" value={formatNumber(urgent)} color="#c0392b" />
            <StatCard icon={<FiUsers />} label="زائران نیازمند پیگیری پرداخت" value={formatNumber(followUp)} color="#b8860b" />
            <StatCard
              icon={<FiTrendingUp />}
              label={`پیش‌بینی درآمد ماه بعد (${curLabel(cur)})`}
              value={nextIncome ? money(nextIncome.value, cur) : 'داده‌ی کافی نیست'}
              color="#0F5132"
            />
            <StatCard
              icon={<FiPercent />}
              label={`نرخ وصول (${curLabel(cur)})`}
              value={cs.rate != null ? pct(cs.rate) : '—'}
              color="#2b6cc0"
            />
          </div>
          <div className="card">
            <div className="card-header"><h3>نکته‌ها و هشدارهای هوشمند</h3></div>
            <div className="card-body"><Insights list={insights} /></div>
          </div>
          {!canExpense && (
            <div className="text-muted mt-2" style={{ fontSize: 12.5 }}>
              دسترسی شما به مصارف محدود است؛ تحلیل مصارف و سود/زیان نمایش داده نمی‌شود.
            </div>
          )}
        </>
      )}

      {/* ───────── درآمد ───────── */}
      {tab === 'revenue' && (
        <>
          <ForecastCard title="درآمد ماهانه و پیش‌بینی" list={ds.incomes} cur={cur} todayKey={todayKey} color="#0F5132" hint="درآمد یعنی مجموع پرداخت‌های دریافتی." />
          <div className="grid-2 mt-3">
            <div className="card">
              <div className="card-header"><h3>بیشترین پرداخت‌کنندگان ({curLabel(cur)})</h3></div>
              <MiniTable
                columns={['زائر', 'مجموع پرداخت', 'تعداد فیش']}
                rows={topPayers(ds.incomes, null, cur, 8).map((r) => [r.name, money(r.sum, cur), toPersianDigits(r.count)])}
                empty="پرداختی ثبت نشده"
              />
            </div>
            <div className="card">
              <div className="card-header"><h3>درآمد به تفکیک نوع پرداخت ({curLabel(cur)})</h3></div>
              <MiniTable
                columns={['نوع پرداخت', 'مبلغ', 'تعداد']}
                rows={incomeTypes.map((r) => [r.name, money(r.sum, cur), toPersianDigits(r.count)])}
                empty="پرداختی ثبت نشده"
              />
            </div>
          </div>
        </>
      )}

      {/* ───────── مشتریان ───────── */}
      {tab === 'customers' && (
        <>
          <div className="stats-grid">
            <StatCard icon={<FiUsers />} label="کل زائران" value={formatNumber(customers.total)} color="#0F5132" />
            <StatCard icon={<FiPercent />} label={`نرخ وصول (${curLabel(cur)})`} value={cs.rate != null ? pct(cs.rate) : '—'} color="#2b6cc0" />
            <StatCard icon={<FiAlertTriangle />} label={`زائران بدهکار (${curLabel(cur)})`} value={formatNumber(cs.debtors)} color="#c0392b" />
            <StatCard icon={<FiShoppingCart />} label={`مجموع باقی‌مانده (${curLabel(cur)})`} value={money(cs.remaining, cur)} color="#a93226" />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>دسته‌بندی زائران بر اساس وضعیت پرداخت</h3></div>
              <div className="card-body" style={{ maxWidth: 360, margin: '0 auto' }}>
                {Object.values(customers.segments).every((v) => v === 0) ? (
                  <div className="text-muted" style={{ fontSize: 13 }}>زائری با قیمت بسته ثبت نشده است.</div>
                ) : (
                  <Doughnut
                    data={{
                      labels: Object.keys(SEGMENT_LABEL).map((k) => `${SEGMENT_LABEL[k]} (${toPersianDigits(customers.segments[k])})`),
                      datasets: [{ data: Object.keys(SEGMENT_LABEL).map((k) => customers.segments[k]), backgroundColor: Object.keys(SEGMENT_LABEL).map((k) => SEGMENT_COLOR[k]) }],
                    }}
                    options={{ plugins: { legend: { position: 'bottom' } } }}
                  />
                )}
              </div>
              <div className="card-body text-muted" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                «متوقف‌شده» یعنی بیش از ۴۵ روز از آخرین پرداخت گذشته و حساب هنوز باز است.
                {customers.noPackage > 0 && ` ${toPersianDigits(customers.noPackage)} زائر فعال قیمت بسته ندارند و در این تحلیل نیستند.`}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>زائران با بیشترین ریسک عدم‌پرداخت ({curLabel(cur)})</h3></div>
              <MiniTable
                columns={['زائر', 'باقی‌مانده', 'ریسک', 'دلیل']}
                rows={customers.riskList.filter((b) => b.key === cur).slice(0, 8).map((b) => [
                  b.name,
                  money(b.remaining, cur),
                  <span key="r" className={`badge ${b.risk.level === 'high' ? 'badge-danger' : b.risk.level === 'mid' ? 'badge-warning' : 'badge-success'}`}>{toPersianDigits(b.risk.score)}</span>,
                  <span key="s" style={{ fontSize: 12 }}>{b.risk.reasons.join('، ')}</span>,
                ])}
                empty="همه‌ی حساب‌ها تسویه است"
              />
              <div className="card-body text-muted" style={{ fontSize: 12.5 }}>
                امتیاز ریسک (۰ تا ۱۰۰) از سه چیز ساخته می‌شود: سهم باقی‌مانده از قیمت بسته، مدت سکوت پرداخت و نداشتن هیچ پرداخت.
              </div>
            </div>
          </div>

          <div className="grid-2 mt-3">
            <div className="card">
              <div className="card-header"><h3>شرکت‌ها</h3></div>
              <MiniTable
                columns={['شرکت', 'زائران', 'باقی‌مانده (افغانی)', 'باقی‌مانده (دالر)']}
                rows={customers.companies.slice(0, 8).map((c) => [c.name, toPersianDigits(c.count), money(c.remaining.afn, 'afn'), money(c.remaining.usd, 'usd')])}
                empty="شرکتی ثبت نشده"
              />
            </div>
            <div className="card">
              <div className="card-header"><h3>گذرنامه‌های نیازمند اقدام</h3></div>
              <MiniTable
                columns={['زائر', 'وضعیت', 'زمان']}
                rows={[
                  ...customers.passports.expired.slice(0, 5).map((x) => [x.name, <span key="e" className="badge badge-danger">منقضی‌شده</span>, `${toPersianDigits(Math.abs(x.days))} روز پیش`]),
                  ...customers.passports.soon.slice(0, 5).map((x) => [x.name, <span key="s" className="badge badge-warning">به‌زودی</span>, `${toPersianDigits(x.days)} روز دیگر`]),
                ]}
                empty="گذرنامه‌ی همه معتبر است"
              />
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header"><h3>زائران بر اساس نوع سفر و وضعیت</h3></div>
            <div className="card-body" style={{ fontSize: 13, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <div className="fw-bold mb-1">نوع سفر</div>
                {Object.entries(customers.byTravel).map(([k, v]) => <div key={k}>{k}: {toPersianDigits(v)}</div>)}
              </div>
              <div>
                <div className="fw-bold mb-1">وضعیت</div>
                {Object.entries(customers.byStatus).map(([k, v]) => <div key={k}>{k}: {toPersianDigits(v)}</div>)}
              </div>
              <div>
                <div className="fw-bold mb-1">نرخ لغو</div>
                <div>{pct(customers.cancelRate)} ({toPersianDigits(customers.cancelled)} نفر)</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───────── مصارف ───────── */}
      {tab === 'expenses' && (
        !canExpense ? (
          <EmptyState title="دسترسی ندارید" description="نقش شما به بخش مصارف دسترسی ندارد، بنابراین تحلیل مصارف نمایش داده نمی‌شود." />
        ) : ds.costs.length === 0 ? (
          <EmptyState title="مصرفی ثبت نشده" description="بعد از ثبت مصارف، تحلیل آن‌ها اینجا نمایش داده می‌شود." />
        ) : (
          <>
            <div className="card mb-2">
              <div className="card-body flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13 }}>
                  مصارف {expPeriod.label}{expPeriod.type !== 'all' && ` (${formatJalali(expPeriod.from)} تا ${formatJalali(expPeriod.to)})`}:{' '}
                  <strong style={{ color: 'var(--danger)' }}>{money(expSums[cur].sum, cur)}</strong>{' '}
                  در {toPersianDigits(expSums[cur].count)} مورد
                </div>
                <div className="chip-group">
                  {EXP_PERIODS.map((p) => (
                    <button key={p.id} className={`chip ${expPeriodId === p.id ? 'active' : ''}`} onClick={() => setExpPeriodId(p.id)}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h3>سهم کتگوری‌ها ({curLabel(cur)})</h3></div>
                {cats.length === 0 ? <EmptyState title="در این بازه مصرفی نیست" /> : (
                  <>
                    <div className="card-body" style={{ maxWidth: 340, margin: '0 auto' }}>
                      <Doughnut
                        data={{ labels: cats.map((c) => c.name), datasets: [{ data: cats.map((c) => Math.round(c.sum)), backgroundColor: cats.map((_, i) => PALETTE[i % PALETTE.length]) }] }}
                        options={{ plugins: { legend: { position: 'bottom' } } }}
                      />
                    </div>
                    <MiniTable
                      columns={['کتگوری', 'مبلغ', 'سهم']}
                      rows={cats.slice(0, 8).map((c) => [c.name, money(c.sum, cur), pct((c.sum / expSums[cur].sum) * 100)])}
                    />
                  </>
                )}
              </div>

              <div className="card">
                <div className="card-header"><h3>درآمد در برابر مصارف ({curLabel(cur)})</h3></div>
                <div className="card-body" style={{ minWidth: 0, overflow: 'hidden' }}>
                  <Bar
                    data={{
                      labels: incVsExp.labels,
                      datasets: [
                        { label: 'درآمد', data: incVsExp.inc, backgroundColor: '#0F5132', borderRadius: 5 },
                        { label: 'مصارف', data: incVsExp.exp, backgroundColor: '#c0392b', borderRadius: 5 },
                      ],
                    }}
                    options={barOpts}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <ForecastCard title="مصارف ماهانه و پیش‌بینی" list={ds.costs} cur={cur} todayKey={todayKey} color="#c0392b" hint="" />
            </div>

            <div className="grid-2 mt-3">
              <div className="card">
                <div className="card-header"><h3>مصارف غیرعادی ({curLabel(cur)})</h3></div>
                <MiniTable
                  columns={['تاریخ', 'کتگوری', 'مبلغ', 'نسبت به معمول']}
                  rows={anomalies.map((a) => [formatJalali(a.expense._d), a.expense.category, money(a.expense._a, cur), `${toPersianDigits(a.ratio.toFixed(1))} برابر`])}
                  empty="مصرف غیرعادی پیدا نشد"
                />
                <div className="card-body text-muted" style={{ fontSize: 12.5 }}>
                  هر کتگوری باید حداقل ۶ مصرف داشته باشد تا «حد معمول» آن مشخص شود.
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h3>جهش مصرف و موارد تکراری</h3></div>
                <MiniTable
                  columns={['کتگوری', 'ماه گذشته', 'میانگین قبلی', 'نسبت']}
                  rows={spikes.map((s) => [s.name, money(s.last, cur), money(s.avg, cur), `${toPersianDigits(s.ratio.toFixed(1))} برابر`])}
                  empty="جهش مصرفی در ماه گذشته دیده نشد"
                />
                <div className="card-body" style={{ fontSize: 13 }}>
                  {duplicates.length === 0 ? (
                    <span className="text-muted">مصرف تکراری مشکوک پیدا نشد.</span>
                  ) : (
                    <>
                      <div className="fw-bold mb-1">{toPersianDigits(duplicates.length)} گروه مصرف تکراری مشکوک:</div>
                      {duplicates.slice(0, 5).map((g, i) => (
                        <div key={i} className="text-muted" style={{ fontSize: 12.5 }}>
                          {toPersianDigits(g.length)} بار «{g[0].description || g[0].category}» — {money(g[0]._a, cur)} در {formatJalali(g[0]._d)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      )}

      {/* ───────── دستیار ───────── */}
      {tab === 'assistant' && <AssistantChat ctx={chatCtx} />}
    </div>
  )
}
