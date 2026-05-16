import { T } from "../styles/index.js";

export function avatarInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ user, size = 32 }) {
  const dim = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  if (user?.avatar_data_url) {
    return <img src={user.avatar_data_url} alt="" style={{ ...dim, objectFit: "cover", display: "block" }} />;
  }
  return <span style={{
    ...dim,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: user?.avatar_color || T.accent, color: T.white,
    fontSize: Math.round(size * 0.4), fontWeight: 700, lineHeight: 1,
    userSelect: "none",
  }}>{avatarInitials(user?.full_name)}</span>;
}

export const AVATAR_COLORS = [
  "#6b4f8a", "#3367d6", "#2f8a4e", "#d97320", "#c93c3c",
  "#0f766e", "#9333ea", "#be185d", "#475569", "#a16207",
];
