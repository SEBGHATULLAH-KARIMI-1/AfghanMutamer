import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMail, FiArrowRight, FiCheckCircle } from 'react-icons/fi'
import { FaMosque } from 'react-icons/fa'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setSent(true)
  }

  return (
    <div className="login-page">
      <div className="islamic-pattern" style={{ opacity: 0.12 }} />
      <div className="login-card">
        <div className="login-emblem"><FaMosque /></div>
        <h2>بازیابی رمز عبور</h2>
        <p className="subtitle">ایمیل حساب کاربری خود را وارد کنید تا لینک بازیابی برای شما ارسال شود</p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <FiCheckCircle style={{ fontSize: 40, color: 'var(--color-secondary)', marginBottom: 12 }} />
            <p style={{ fontSize: 13.5 }}>
              در صورت معتبر بودن ایمیل وارد شده، لینک بازیابی رمز عبور برای شما ارسال شد.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-field mb-2">
              <label>ایمیل</label>
              <div className="search-box" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.25)' }}>
                <FiMail />
                <input
                  type="email"
                  placeholder="example@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ color: '#fff' }}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-gold btn-block">ارسال لینک بازیابی</button>
          </form>
        )}

        <div className="forgot-link">
          <Link to="/login"><FiArrowRight /> بازگشت به صفحه ورود</Link>
        </div>
      </div>
    </div>
  )
}
