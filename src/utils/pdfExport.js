import jsPDF from 'jspdf'
import { formatJalali } from './dateUtils'

// تعداد ردیف در هر صفحه‌ی PDF (جدول‌های بلند به چند صفحه تقسیم می‌شوند)
const ROWS_PER_PAGE = 15

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPdfHtml({ title, columns, rows, withTitle = true }) {
  let html = '<div style="width:850px;margin:0 auto;padding:20px">'
  if (withTitle) {
    html += `<h2 style="color:#0F5132;margin:0 0 4px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">${esc(title)}</h2>`
    html += `<p style="color:#667085;font-size:12px;margin:0 0 16px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">${formatJalali(new Date())}</p>`
  }
  html += '<table dir="rtl" style="border-collapse:collapse;width:100%;font-family:Vazirmatn,Tahoma,sans-serif;font-size:11px">'
  html += '<thead><tr>'
  columns.forEach((c) => {
    html += `<th style="background:#0F5132;color:#fff;padding:6px 8px;text-align:center;border:1px solid #0F5132">${esc(c)}</th>`
  })
  html += '</tr></thead><tbody>'
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8f9fa'
    html += '<tr>'
    row.forEach((cell) => {
      html += `<td style="background:${bg};padding:4px 8px;text-align:center;border:1px solid #e0e0e0">${esc(cell)}</td>`
    })
    html += '</tr>'
  })
  html += '</tbody></table>'
  html += '</div>'
  return html
}

async function renderToCanvas(html) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;width:890px'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)
  try {
    const { default: html2canvas } = await import('html2canvas')
    return await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  } finally {
    document.body.removeChild(wrapper)
  }
}

// جدول را صفحه‌به‌صفحه می‌سازد؛ هر صفحه سربرگ ستون‌ها را دارد و محتوا از صفحه بیرون نمی‌زند
async function buildTablePdf({ title, columns, rows }) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const chunks = []
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE))
  if (chunks.length === 0) chunks.push([])

  for (let i = 0; i < chunks.length; i++) {
    const html = buildPdfHtml({ title, columns, rows: chunks[i], withTitle: i === 0 })
    const canvas = await renderToCanvas(html)
    if (i > 0) doc.addPage()
    let w = pageW
    let h = (canvas.height * w) / canvas.width
    if (h > pageH) {
      h = pageH
      w = (canvas.width * h) / canvas.height
    }
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, 0, w, h)
  }
  return doc
}

export async function exportTableToPDF({ title, columns, rows, fileName }) {
  const doc = await buildTablePdf({ title, columns, rows })
  doc.save(fileName || 'report.pdf')
}

export async function previewPdfBlob({ title, columns, rows }) {
  const doc = await buildTablePdf({ title, columns, rows })
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

export async function exportReceiptToPDF(payment, company, remainingBalance, remainingCurrency) {
  const currency = payment.currency || 'افغانی'
  const infoRows = [
    ['شماره فیش', payment.receiptNumber],
    ['زائر', payment.pilgrimName],
    ['مبلغ', Number(payment.amount).toLocaleString() + ' ' + currency],
    ['نوع پرداخت', payment.paymentType],
    ['تاریخ', formatJalali(payment.date)],
    ['وضعیت', payment.status],
    ['توضیحات', payment.description || '-'],
  ]
  if (remainingBalance !== undefined && Number(remainingBalance) > 0) {
    infoRows.push(['باقی مانده حساب', Number(remainingBalance).toLocaleString() + ' ' + (remainingCurrency || currency)])
  }
  const html = `
    <div style="width:400px;margin:0 auto;padding:20px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">
      <div style="background:#0F5132;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0">
        <div style="font-size:16px;font-weight:700">${esc(company?.companyName || 'Hajj & Umrah Agency')}</div>
        <div style="font-size:10px;opacity:0.9">${esc(company?.address || '')}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:#0F5132;padding:12px 0 8px;border-bottom:2px solid #D4AF37">رسید پرداخت</div>
      <table dir="rtl" style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px">
        ${infoRows.map(([label, value]) => `
          <tr>
            <td style="text-align:right;padding:5px 8px;color:#667085;border-bottom:1px solid #eee;width:35%">${esc(label)}</td>
            <td style="text-align:right;padding:5px 8px;font-weight:600;border-bottom:1px solid #eee">${esc(value)}</td>
          </tr>
        `).join('')}
      </table>
      <div style="font-size:9px;color:#aaa;margin-top:16px">این رسید توسط سیستم صادر شده است</div>
    </div>
  `
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:440px'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)
  let canvas
  try {
    const { default: html2canvas } = await import('html2canvas')
    canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  } finally {
    document.body.removeChild(wrapper)
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = doc.internal.pageSize.getWidth()
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  doc.save(`receipt-${payment.receiptNumber}.pdf`)
}
