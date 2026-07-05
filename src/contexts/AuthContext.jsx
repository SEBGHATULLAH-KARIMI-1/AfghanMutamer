import { createContext, useContext, useState, useMemo } from 'react'
import { storage, KEYS, generateId } from '../utils/storage'

function resolvePermissions(roleName) {
  const roles = storage.getAll(KEYS.ROLES)
  const found = roles.find((r) => r.name === roleName)
  return found ? found.permissions : null
}

function getRoleLabel(roleName) {
  const roles = storage.getAll(KEYS.ROLES)
  const found = roles.find((r) => r.name === roleName)
  return found ? found.label : roleName
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => storage.get(KEYS.AUTH, null))

  const permissions = useMemo(() => {
    if (!user) return null
    return resolvePermissions(user.role)
  }, [user])

  function login(username, password) {
    const users = storage.getAll(KEYS.USERS)
    const found = users.find((u) => u.username === username && u.password === password)
    if (!found) {
      return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }
    }
    const session = { id: found.id, username: found.username, name: found.name, role: found.role }
    storage.set(KEYS.AUTH, session)
    setUser(session)

    const logs = storage.getAll(KEYS.LOGS)
    logs.unshift({
      id: generateId(),
      date: new Date().toISOString(),
      user: found.username,
      action: 'ورود به سیستم',
      details: 'کاربر با موفقیت وارد سیستم شد',
    })
    storage.saveAll(KEYS.LOGS, logs)

    return { success: true }
  }

  function logout() {
    if (user) {
      const logs = storage.getAll(KEYS.LOGS)
      logs.unshift({
        id: generateId(),
        date: new Date().toISOString(),
        user: user.username,
        action: 'خروج از سیستم',
        details: 'کاربر از سیستم خارج شد',
      })
      storage.saveAll(KEYS.LOGS, logs)
    }
    storage.remove(KEYS.AUTH)
    setUser(null)
  }

  function can(page, action = 'view') {
    if (!permissions) return false
    const pagePerms = permissions[page]
    if (!pagePerms) return false
    return !!pagePerms[action]
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, can, permissions, getRoleLabel }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
