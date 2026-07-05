import { toPersianDigits } from '../../utils/dateUtils'

export default function Pagination({ page, totalPages, onChange, totalItems, pageSize }) {
  if (totalPages <= 1) {
    return (
      <div className="pagination">
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          نمایش {toPersianDigits(totalItems)} مورد
        </span>
      </div>
    )
  }

  const pages = []
  for (let i = 1; i <= totalPages; i++) pages.push(i)

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="pagination">
      <span className="text-muted" style={{ fontSize: 12.5 }}>
        نمایش {toPersianDigits(start)} تا {toPersianDigits(end)} از {toPersianDigits(totalItems)} مورد
      </span>
      <div className="pagination-pages">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
        {pages.map((p) => (
          <button key={p} className={p === page ? 'active' : ''} onClick={() => onChange(p)}>
            {toPersianDigits(p)}
          </button>
        ))}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
      </div>
    </div>
  )
}
