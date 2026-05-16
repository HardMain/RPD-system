import { filterChipStyle } from "../styles/index.js";

export function FilterChip({ label, count, active, color, bg, onClick }) {
  const isActive = active && (count === undefined || count >= 0);
  return <button
    type="button"
    onClick={onClick}
    style={filterChipStyle({ active: isActive, color, bg })}
  >
    {label}
    {count !== undefined && <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>({count})</span>}
  </button>;
}
