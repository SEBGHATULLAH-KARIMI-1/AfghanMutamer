import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { formatNumber } from '../../utils/dateUtils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// نمودار «واقعی + پیش‌بینی + بازه‌ی محتمل». ماه جاری (ناقص) با نقطه‌ی روشن نشان داده می‌شود.
export default function ForecastChart({ series, forecast, name, color = '#0F5132' }) {
  const pts = forecast?.points || []
  const keys = [...series.map((s) => s.key), ...pts.map((p) => p.key).filter((k) => !series.some((s) => s.key === k))]
  const labels = keys.map((k) => series.find((s) => s.key === k)?.label || pts.find((p) => p.key === k)?.label)
  const at = (k) => keys.indexOf(k)

  const actual = keys.map((k) => series.find((s) => s.key === k)?.value ?? null)
  const fc = keys.map(() => null)
  const low = keys.map(() => null)
  const high = keys.map(() => null)

  // خط پیش‌بینی از آخرین ماه کامل شروع می‌شود تا به نمودار واقعی وصل باشد
  const lastDone = [...series].reverse().find((s) => !s.partial)
  if (lastDone && pts.length) fc[at(lastDone.key)] = lastDone.value
  pts.forEach((p) => {
    fc[at(p.key)] = Math.round(p.value)
    low[at(p.key)] = Math.round(p.low)
    high[at(p.key)] = Math.round(p.high)
  })

  const data = {
    labels,
    datasets: [
      {
        label: `واقعی (${name})`,
        data: actual,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: keys.map((k) => (series.find((s) => s.key === k)?.partial ? '#fff' : color)),
        pointBorderColor: color,
        spanGaps: false,
      },
      {
        label: 'پیش‌بینی',
        data: fc,
        borderColor: '#D4AF37',
        backgroundColor: '#D4AF37',
        borderDash: [6, 5],
        tension: 0.3,
        pointRadius: 4,
        spanGaps: true,
      },
      { label: 'low', data: low, borderColor: 'transparent', pointRadius: 0, fill: false, showLegend: false },
      {
        label: 'بازه‌ی محتمل',
        data: high,
        borderColor: 'transparent',
        backgroundColor: 'rgba(212,175,55,0.18)',
        pointRadius: 0,
        fill: '-1',
      },
    ],
  }

  const options = {
    responsive: true,
    aspectRatio: typeof window !== 'undefined' && window.innerWidth < 640 ? 1.2 : 2,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { filter: (item, d) => d.datasets[item.datasetIndex].showLegend !== false } },
      tooltip: {
        filter: (item) => item.dataset.label !== 'low' && item.raw != null,
        callbacks: { label: (c) => `${c.dataset.label}: ${formatNumber(Math.round(c.raw))}` },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } },
    },
  }

  return <Line data={data} options={options} />
}
