import jsPDF from 'jspdf'
import { formatJalali } from './dateUtils'

function buildPdfHtml({ title, columns, rows }) {
  let html = '<div style="width:850px;margin:0 auto;padding:20px">'
  html += `<h2 style="color:#0F5132;margin:0 0 4px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">${title}</h2>`
  html += `<p style="color:#667085;font-size:12px;margin:0 0 16px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">${formatJalali(new Date())}</p>`
  html += '<table dir="rtl" style="border-collapse:collapse;width:100%;font-family:Vazirmatn,Tahoma,sans-serif;font-size:11px">'
  html += `<p style="color:#667085;font-size:12px;margin:0 0 16px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">${formatJalali(new Date())}</p>`
  html += '<table dir="rtl" style="border-collapse:collapse;width:100%;font-family:Vazirmatn,Tahoma,sans-serif;font-size:11px">'
  html += '<thead><tr>'
  columns.forEach((c) => {
    html += `<th style="background:#0F5132;color:#fff;padding:6px 8px;text-align:center;border:1px solid #0F5132">${c}</th>`
  })
  html += '</tr></thead><tbody>'
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8f9fa'
    html += '<tr>'
    row.forEach((cell) => {
      html += `<td style="background:${bg};padding:4px 8px;text-align:center;border:1px solid #e0e0e0">${cell}</td>`
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
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  document.body.removeChild(wrapper)
  return canvas
}

export async function exportTableToPDF({ title, columns, rows, fileName }) {
  const html = buildPdfHtml({ title, columns, rows })
  const canvas = await renderToCanvas(html)
  const doc = new jsPDF({ orientation: 'landscape' })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = doc.internal.pageSize.getWidth()
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  doc.save(fileName || 'report.pdf')
}

export async function previewPdfBlob({ title, columns, rows }) {
  const html = buildPdfHtml({ title, columns, rows })
  const canvas = await renderToCanvas(html)
  const doc = new jsPDF({ orientation: 'landscape' })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = doc.internal.pageSize.getWidth()
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

export async function exportReceiptToPDF(payment, company) {
  const currency = payment.currency || 'افغانی'
  const infoRows = [
    ['شماره فیش', payment.receiptNumber],
    ['زائر', payment.pilgrimName],
    ['مبلغ', Number(payment.amount).toLocaleString() + ' ' + currency],
    ['نوع پرداخت', payment.paymentType],
    ['تاریخ', payment.date],
    ['وضعیت', payment.status],
    ['توضیحات', payment.description || '-'],
  ]
  const html = `
    <div style="width:400px;margin:0 auto;padding:20px;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center">
      <div style="background:#0F5132;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0">
        <div style="font-size:16px;font-weight:700">${company?.companyName || 'Hajj & Umrah Agency'}</div>
        <div style="font-size:10px;opacity:0.9">${company?.address || ''}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:#0F5132;padding:12px 0 8px;border-bottom:2px solid #D4AF37">رسید پرداخت</div>
      <table dir="rtl" style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px">
        ${infoRows.map(([label, value]) => `
          <tr>
            <td style="text-align:right;padding:5px 8px;color:#667085;border-bottom:1px solid #eee;width:35%">${label}</td>
            <td style="text-align:right;padding:5px 8px;font-weight:600;border-bottom:1px solid #eee">${value}</td>
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
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  document.body.removeChild(wrapper)
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = doc.internal.pageSize.getWidth()
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  doc.save(`receipt-${payment.receiptNumber}.pdf`)
}
