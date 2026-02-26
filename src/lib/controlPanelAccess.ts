export const CONTROL_PANEL_OWNER_EMAIL = "fyequise03@gmail.com";

const normalizeEmail = (value?: string | null) => String(value || "").trim().toLowerCase();

export const isControlPanelOwnerEmail = (email?: string | null) =>
  normalizeEmail(email) === CONTROL_PANEL_OWNER_EMAIL;
