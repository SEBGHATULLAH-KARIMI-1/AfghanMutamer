import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiUser, FiLock, FiEye, FiEyeOff, FiLogIn } from 'react-icons/fi'
import { FaMosque } from 'react-icons/fa'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function Login() {
  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('لطفا نام کاربری و رمز عبور را وارد کنید.')
      return
    }
    setLoading(true)
    setTimeout(() => {
      const result = login(username, password)
      setLoading(false)
      if (result.success) {
        showToast('ورود با موفقیت انجام شد', 'success')
        navigate('/')
      } else {
        setError(result.message)
      }
    }, 500)
  }

  return (
    <div className="login-page">
      <div className="islamic-pattern" style={{ opacity: 0.12 }} />
      <div className="login-card">
        <div className="login-emblem"><FaMosque /></div>
        <h2>سیستم مدیریت حج و عمره</h2>
        <p className="subtitle">برای ورود به پنل مدیریت اطلاعات خود را وارد کنید</p>

        <form onSubmit={handleSubmit}>
          <div className="form-field mb-2">
            <label>نام کاربری</label>
            <div className="search-box" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.25)' }}>
              <FiUser />
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ color: '#fff' }}
              />
            </div>
          </div>

          <div className="form-field mb-2">
            <label>رمز عبور</label>
            <div className="search-box" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.25)' }}>
              <FiLock />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ color: '#fff' }}
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)' }}>
                {showPass ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {error && <div className="error-text mb-2">{error}</div>}

          <button type="submit" className="btn btn-gold btn-block" disabled={loading}>
            <FiLogIn /> {loading ? 'در حال ورود...' : 'ورود به سیستم'}
          </button>
        </form>

        <div className="forgot-link">
          <Link to="/forgot-password">رمز عبور خود را فراموش کرده‌اید؟</Link>
        </div>

        <div className="demo-hint">
          نام کاربری آزمایشی: <b>admin</b> — رمز عبور: <b>admin123</b>
        </div>
      </div>
    </div>
  )
}
