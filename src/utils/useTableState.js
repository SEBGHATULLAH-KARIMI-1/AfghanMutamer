import { useMemo, useState } from 'react'

// نرمال‌سازی متن برای جستجو: حروف عربی ← فارسی، ارقام فارسی/عربی ← لاتین، حذف نیم‌فاصله
export function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\u200c/g, '')
}

export function useTableState(data, { searchFields = [], pageSize = 8 } = {}) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = data || []
    if (search.trim()) {
      const q = normalize(search.trim())
      // فیلدها با فاصله به هم وصل می‌شوند تا جستجوی «نام + نام خانوادگی» هم کار کند
      list = list.filter((item) =>
        searchFields.map((f) => normalize(item[f])).join(' ').includes(q)
      )
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        list = list.filter((item) => String(item[key]) === String(value))
      }
    })
    return list
  }, [data, search, filters, searchFields])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }
  function updateSearch(value) {
    setSearch(value)
    setPage(1)
  }

  return {
    search, setSearch: updateSearch,
    filters, setFilter: updateFilter,
    page: currentPage, setPage,
    totalPages,
    filtered,
    paginated,
    totalItems: filtered.length,
    pageSize,
  }
}
