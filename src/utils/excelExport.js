import ExcelJS from 'exceljs'

export async function exportToExcel({ sheetName, rows, fileName }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Hajj & Umrah System'
  workbook.created = new Date()

  const ws = workbook.addWorksheet(sheetName || 'Sheet1')

  const headers = Object.keys(rows[0] || {})

  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Vazirmatn', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F5132' } },
      bottom: { style: 'thin', color: { argb: 'FF0F5132' } },
      left: { style: 'thin', color: { argb: 'FF0F5132' } },
      right: { style: 'thin', color: { argb: 'FF0F5132' } },
    }
  })

  rows.forEach((rowData, i) => {
    const row = ws.addRow(headers.map((h) => rowData[h]))
    const bgColor = i % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF'
    row.eachCell((cell) => {
      cell.font = { name: 'Vazirmatn', size: 10, color: { argb: 'FF1A1F1C' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      }
    })
  })

  ws.columns = headers.map(() => ({ width: 16 }))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'export.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
