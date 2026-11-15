import { Link } from 'react-router-dom'
import { FiArrowRight, FiInfo } from 'react-icons/fi'
import { FaMosque } from 'react-icons/fa'

// این برنامه سروری برای ارسال ایمیل ندارد؛ بازیابی رمز عبور فقط توسط مدیر سیستم ممکن است
export default function ForgotPassword() {
  return (
    <div className="login-page">
      <div className="islamic-pattern" style={{ opacity: 0.12 }} />
      <div className="login-card">
        <div className="login-emblem"><FaMosque /></div>
        <h2>بازیابی رمز عبور</h2>
        <p className="subtitle">ارسال ایمیل در این نسخه پشتیبانی نمی‌شود</p>

        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <FiInfo style={{ fontSize: 40, color: 'var(--color-secondary)', marginBottom: 12 }} />
          <p style={{ fontSize: 13.5, lineHeight: 1.9 }}>
            برای بازیابی رمز عبور با مدیر سیستم تماس بگیرید.
            مدیر می‌تواند از بخش «تنظیمات ← مدیریت کاربران» رمز جدیدی برای حساب شما تعیین کند.
          </p>
        </div>

        <div className="forgot-link">
          <Link to="/login"><FiArrowRight /> بازگشت به صفحه ورود</Link>
        </div>
      </div>
    </div>
  )
}
