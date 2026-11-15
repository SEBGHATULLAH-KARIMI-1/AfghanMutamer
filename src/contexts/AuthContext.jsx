import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, apiErrorMessage, token, setUnauthorizedHandler } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState(null)
  // اگر توکن ذخیره‌شده باشد، تا بررسی آن توسط سرور «در حال بارگذاری» هستیم
  const [loading, setLoading] = useState(() => !!token.get())

  const clearSession = useCallback(() => {
    token.clear()
    setUser(null)
    setPermissions(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
  }, [clearSession])

  useEffect(() => {
    if (!token.get()) { setLoading(false); return undefined }
    let alive = true
    api('/auth/me')
      .then((d) => { if (alive) { setUser(d.user); setPermissions(d.permissions) } })
      .catch((e) => { if (alive && e.status === 401) clearSession() })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [clearSession])

  async function login(username, password) {
    try {
      const d = await api('/auth/login', { method: 'POST', body: { username, password } })
      token.set(d.token)
      setUser(d.user)
      setPermissions(d.permissions)
      return { success: true }
    } catch (e) {
      return { success: false, message: apiErrorMessage(e) }
    }
  }

  function logout() {
    if (user) api('/auth/logout', { method: 'POST' }).catch(() => {}) // توکن همین لحظه خوانده می‌شود، پیش از پاک‌شدن
    clearSession()
  }

  // بعد از ویرایش کاربران یا نقش‌ها صدا زده می‌شود تا نقش و دسترسی‌های کاربر فعلی از سرور بازخوانی شود
  async function refreshAuth() {
    if (!token.get()) return
    try {
      const d = await api('/auth/me')
      setUser(d.user)
      setPermissions(d.permissions)
    } catch (e) {
      if (e.status === 401) clearSession()
    }
  }

  const getRoleLabel = useCallback(
    (roleName) => (user && roleName === user.role && user.roleLabel ? user.roleLabel : roleName),
    [user],
  )

  // اگر صفحه‌ای در دسترسی‌های نقش تعریف نشده باشد، دسترسی داده نمی‌شود (پیش‌فرض: ممنوع)
  function can(page, action = 'view') {
    if (!permissions) return false
    const pagePerms = permissions[page]
    if (!pagePerms) return false
    return !!pagePerms[action]
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: !!user, can, permissions, getRoleLabel, refreshAuth }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, permissions, getRoleLabel],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
