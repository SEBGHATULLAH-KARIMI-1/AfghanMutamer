import { useMemo, useState } from 'react'

export function useTableState(data, { searchFields = [], pageSize = 8 } = {}) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = data || []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((item) =>
        searchFields.some((f) => String(item[f] || '').toLowerCase().includes(q))
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
