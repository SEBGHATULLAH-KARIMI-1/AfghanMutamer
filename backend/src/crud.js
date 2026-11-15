import { Router } from 'express'
import { query, tx } from './db.js'
import { requireAny, requirePerm } from './auth.js'
import { HttpError, coerce, snake, camelize, logActivity } from './util.js'

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/

// روتر عمومی CRUD؛ فقط ستون‌های تعریف‌شده در def.columns خوانده/نوشته می‌شوند
export function crudRouter(def) {
  const cols = Object.keys(def.columns)
  const sel = [...new Set(['id', ...cols.map(snake), 'created_at'])].map((c) => `"${c}"`).join(', ')
  const T = `"${def.table}"`

  const toPatch = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'بدنه‌ی درخواست نامعتبر است')
    const patch = {}
    for (const [key, type] of Object.entries(def.columns)) {
      if (body[key] !== undefined) patch[key] = coerce(type, body[key], key)
    }
    return patch
  }

  const router = Router()
  const readGuard = requireAny(def.readPages ?? [def.perm], 'view')

  router.get('/', readGuard, async (_req, res) => {
    const { rows } = await query(`select ${sel} from ${T} order by seq desc`)
    res.json(rows.map(camelize))
  })

  router.get('/:id', readGuard, async (req, res) => {
    const { rows } = await query(`select ${sel} from ${T} where id = $1`, [req.params.id])
    if (!rows[0]) throw new HttpError(404, 'یافت نشد')
    res.json(camelize(rows[0]))
  })

  router.post('/', requirePerm(def.perm, 'create'), async (req, res) => {
    const patch = toPatch(req.body)
    // فرانت می‌تواند شناسه‌ی خودش را بدهد (برای نمایش فوری قبل از پاسخ سرور)
    const clientId = typeof req.body.id === 'string' && ID_RE.test(req.body.id) ? req.body.id : null
    def.validate?.(patch, null)
    const created = await tx(async (client) => {
      await def.prepare?.(client, patch, null)
      const keys = Object.keys(patch)
      const names = [...(clientId ? ['id'] : []), ...keys.map(snake)]
      const vals = [...(clientId ? [clientId] : []), ...keys.map((k) => patch[k])]
      const sql = names.length
        ? `insert into ${T} (${names.map((n) => `"${n}"`).join(', ')}) values (${names.map((_, i) => `$${i + 1}`).join(', ')}) returning ${sel}`
        : `insert into ${T} default values returning ${sel}`
      const { rows } = await client.query(sql, vals)
      const row = camelize(rows[0])
      await def.afterWrite?.(client, null, row)
      await logActivity(client, req.user.username, `افزودن ${def.label}`, `${def.label} "${def.describe(row)}" اضافه شد`)
      return row
    })
    res.status(201).json(created)
  })

  const update = async (req, res) => {
    const patch = toPatch(req.body)
    const updated = await tx(async (client) => {
      const cur = await client.query(`select ${sel} from ${T} where id = $1 for update`, [req.params.id])
      if (!cur.rows[0]) throw new HttpError(404, 'یافت نشد')
      const before = camelize(cur.rows[0])
      def.validate?.({ ...before, ...patch }, before)
      await def.prepare?.(client, patch, before)
      const keys = Object.keys(patch)
      let after = before
      if (keys.length) {
        const { rows } = await client.query(
          `update ${T} set ${keys.map((k, i) => `"${snake(k)}" = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning ${sel}`,
          [...keys.map((k) => patch[k]), req.params.id],
        )
        after = camelize(rows[0])
      }
      await def.afterWrite?.(client, before, after)
      await logActivity(client, req.user.username, `ویرایش ${def.label}`, `${def.label} "${def.describe(after)}" ویرایش شد`)
      return after
    })
    res.json(updated)
  }
  router.put('/:id', requirePerm(def.perm, 'edit'), update)
  router.patch('/:id', requirePerm(def.perm, 'edit'), update)

  router.delete('/:id', requirePerm(def.perm, 'delete'), async (req, res) => {
    await tx(async (client) => {
      const { rows } = await client.query(`delete from ${T} where id = $1 returning ${sel}`, [req.params.id])
      if (!rows[0]) throw new HttpError(404, 'یافت نشد')
      await logActivity(client, req.user.username, `حذف ${def.label}`, `${def.label} "${def.describe(camelize(rows[0]))}" حذف شد`)
    })
    res.status(204).end()
  })

  return router
}
