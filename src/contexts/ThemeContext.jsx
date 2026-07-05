import { createContext, useContext, useEffect, useState } from 'react'
import { storage, KEYS } from '../utils/storage'

const APPEARANCE_KEY = 'hums_appearance'

function loadAppearance() {
  return storage.get(APPEARANCE_KEY, { colorTheme: 'default', sidebarStyle: 'gradient' })
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => storage.get(KEYS.THEME, 'light'))
  const [appearance, setAppearance] = useState(loadAppearance)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    storage.set(KEYS.THEME, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', appearance.colorTheme)
    document.documentElement.setAttribute('data-sidebar-style', appearance.sidebarStyle)
    storage.set(APPEARANCE_KEY, appearance)
  }, [appearance])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const updateAppearance = (patch) => setAppearance((prev) => ({ ...prev, ...patch }))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, appearance, updateAppearance }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
