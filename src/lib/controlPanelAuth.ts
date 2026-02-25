export const CONTROL_PANEL_PASSWORD_STORAGE_KEY = "control_panel_password"
const DEFAULT_CONTROL_PANEL_PASSWORD = "Quise"

const hasWindow = () => typeof window !== "undefined"

const normalizePassword = (value: unknown) => {
  const trimmed = String(value || "").trim()
  return trimmed || ""
}

export const getControlPanelPassword = () => {
  if (!hasWindow()) return DEFAULT_CONTROL_PANEL_PASSWORD
  const stored = normalizePassword(window.sessionStorage.getItem(CONTROL_PANEL_PASSWORD_STORAGE_KEY))
  return stored || DEFAULT_CONTROL_PANEL_PASSWORD
}

export const setControlPanelPassword = (password: string) => {
  if (!hasWindow()) return
  const normalized = normalizePassword(password)
  if (!normalized) {
    window.sessionStorage.removeItem(CONTROL_PANEL_PASSWORD_STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(CONTROL_PANEL_PASSWORD_STORAGE_KEY, normalized)
}

export const clearControlPanelPassword = () => {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(CONTROL_PANEL_PASSWORD_STORAGE_KEY)
}
