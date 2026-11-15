import { useEffect, useRef, useState } from 'react'
import { FiSend, FiCpu, FiUser, FiZap } from 'react-icons/fi'
import { answerQuestion, HELP_TEXT, SUGGESTIONS } from '../../utils/ai/assistant'
import { fetchAiStatus, sendAiChat } from '../../utils/ai/aiClient'
import { TOOLS, runTool } from '../../utils/ai/tools'
import { formatJalali } from '../../utils/dateUtils'

const MAX_STEPS = 6      // حداکثر چند بار مدل می‌تواند ابزار صدا بزند تا جواب نهایی بدهد
const MAX_HISTORY = 20   // آخرین پیام‌های گفتگو که برای زمینه می‌فرستیم

// دستیار هوشمند: اگر هوش مصنوعی روی سرور فعال باشد، مدل زبانی با ابزارهایی که روی داده‌های واقعی اجرا می‌شوند جواب می‌دهد؛
// اگر نه (کلید تنظیم نشده یا خطا)، موتور محلی قبلی جواب می‌دهد.
// توجه: وقتی هوش مصنوعی فعال است، نتیجه‌ی ابزارها (مثل نام زائر، مبلغ‌ها) برای ساختن جواب به سرویس هوش مصنوعی فرستاده می‌شود.
export default function AssistantChat({ ctx }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: HELP_TEXT }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState({ loading: true, enabled: false, model: null })
  const memory = useRef({})
  const history = useRef([])   // فقط پیام‌های متنیِ نهایی (بدون ابزار)؛ برای گفتگوی دنباله‌دار
  const ctxRef = useRef(ctx)
  const endRef = useRef(null)

  ctxRef.current = ctx

  useEffect(() => {
    let alive = true
    fetchAiStatus().then((s) => { if (alive) setAi({ loading: false, enabled: !!s.enabled, model: s.model || null }) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function askAI(question) {
    const c = ctxRef.current
    const today = { iso: c.today, jalali: formatJalali(c.today) }
    const base = history.current.slice(-MAX_HISTORY)
    let msgs = [...base, { role: 'user', content: question }]
    const tables = []

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const data = await sendAiChat({ messages: msgs, tools: TOOLS, today })
      msgs = [...msgs, { role: 'assistant', content: data.content }]

      if (data.stop_reason === 'tool_use') {
        const results = data.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => {
            const r = runTool(b.name, b.input, ctxRef.current)
            tables.push(...r.tables)
            return { type: 'tool_result', tool_use_id: b.id, content: r.content, ...(r.isError ? { is_error: true } : {}) }
          })
        msgs = [...msgs, { role: 'user', content: results }]
        continue
      }

      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
      const finalText = text || 'جوابی دریافت نشد؛ لطفاً سؤال را دوباره بپرسید.'
      history.current = [...base, { role: 'user', content: question }, { role: 'assistant', content: finalText }].slice(-MAX_HISTORY)
      const seen = new Set()
      const uniq = tables.filter((t) => (seen.has(t.title) ? false : seen.add(t.title)))
      return { role: 'assistant', text: finalText, tables: uniq, ai: true }
    }
    throw new Error('دستیار نتوانست جواب را کامل کند؛ سؤال را ساده‌تر بپرسید.')
  }

  function askLocal(question, note) {
    let reply
    try {
      const res = answerQuestion(question, ctxRef.current, memory.current)
      memory.current = res.memory || memory.current
      reply = { role: 'assistant', text: res.text, tables: res.tables }
    } catch {
      reply = { role: 'assistant', text: 'در محاسبه‌ی این سؤال خطایی رخ داد. لطفاً سؤال را کمی ساده‌تر بپرسید.' }
    }
    if (note) reply.text = `${note}\n\n${reply.text}`
    return reply
  }

  async function send(text) {
    const q = String(text ?? input).trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setBusy(true)

    let reply
    if (ai.enabled) {
      try {
        reply = await askAI(q)
      } catch (e) {
        reply = askLocal(q, `⚠️ ${e.message || 'اتصال به هوش مصنوعی ممکن نشد'} — جواب از موتور محلی:`)
      }
    } else {
      // تأخیر کوتاه فقط برای حس گفتگو
      await new Promise((r) => setTimeout(r, 350))
      reply = askLocal(q)
    }
    setMessages((m) => [...m, reply])
    setBusy(false)
  }

  return (
    <div className="card ai-chat">
      <div className="card-body" style={{ paddingBottom: 0, fontSize: 12.5 }}>
        {ai.loading ? (
          <span className="text-muted">در حال بررسی اتصال دستیار…</span>
        ) : ai.enabled ? (
          <span style={{ color: 'var(--success, #1d8a4e)' }}>
            <FiZap style={{ verticalAlign: '-2px' }} /> هوش مصنوعی فعال است{ai.model ? ` (${ai.model})` : ''} — هر عددی که می‌گوید از داده‌های واقعی شما محاسبه می‌شود.
          </span>
        ) : (
          <span className="text-muted">
            هوش مصنوعی تنظیم نشده؛ دستیار فقط از موتور محلی استفاده می‌کند (کلید ANTHROPIC_API_KEY را روی سرور بگذارید).
          </span>
        )}
      </div>

      <div className="ai-chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <span className="ai-avatar">{m.role === 'user' ? <FiUser /> : <FiCpu />}</span>
            <div className="ai-bubble">
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              {m.tables?.map((t, ti) => (
                <div key={ti} className="ai-table-wrap">
                  <div className="ai-table-title">{t.title}</div>
                  <div className="table-wrapper">
                    <table className="data-table ai-table">
                      <thead><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {t.rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="ai-msg assistant">
            <span className="ai-avatar"><FiCpu /></span>
            <div className="ai-bubble text-muted">{ai.enabled ? 'در حال بررسی داده‌ها و نوشتن جواب…' : 'در حال محاسبه…'}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="ai-suggestions chip-group">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>
        ))}
      </div>

      <div className="ai-chat-input">
        <input
          className="text-input"
          placeholder="سؤال خود را بنویسید… مثال: چرا این ماه مصارف زیاد شده؟"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={busy || !input.trim()}>
          <FiSend /> ارسال
        </button>
      </div>
    </div>
  )
}
