// Service Worker ساده: ظاهر برنامه (فایل‌های سایت) ذخیره می‌شود تا سریع‌تر باز شود.
// اطلاعات (زائران، پرداخت‌ها ...) هرگز ذخیره نمی‌شوند و همیشه از سرور خوانده می‌شوند.
const CACHE = 'hums-shell-v1'
const PRECACHE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // بک‌اند، فونت‌ها و ... دست نمی‌خورند
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/__demo_ai')) return

  // صفحه‌ی اصلی: اول اینترنت (تا نسخه‌ی جدید را بگیرد)، اگر نبود نسخه‌ی ذخیره‌شده
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }

  // فایل‌های دیگر (js، css، عکس): از حافظه بده و در پس‌زمینه تازه کن
  event.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || fresh
    }),
  )
})
