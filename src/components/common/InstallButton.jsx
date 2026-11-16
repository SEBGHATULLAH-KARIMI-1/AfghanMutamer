import { useEffect, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { useToast } from '../../contexts/ToastContext'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

// دکمه‌ی «نصب برنامه»: در کروم/اندروید پنجره‌ی نصب را باز می‌کند؛ در آیفون راهنمای نصب نشان می‌دهد.
// اگر برنامه قبلاً نصب شده باشد دکمه نمایش داده نمی‌شود.
export default function InstallButton() {
  const { showToast } = useToast()
  const [promptEvent, setPromptEvent] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e) }
    const onInstalled = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  const ios = isIOS()
  if (!promptEvent && !ios) return null

  async function install() {
    if (promptEvent) {
      promptEvent.prompt()
      await promptEvent.userChoice
      setPromptEvent(null)
    } else {
      showToast('در سافاری دکمه‌ی اشتراک‌گذاری را بزنید و «Add to Home Screen» را انتخاب کنید', 'info')
    }
  }

  return (
    <button className="icon-btn" onClick={install} title="نصب برنامه روی موبایل" aria-label="نصب برنامه">
      <FiDownload />
    </button>
  )
}
