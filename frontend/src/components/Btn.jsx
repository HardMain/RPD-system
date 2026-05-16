import { btnStyle } from "../styles/index.js";

export function Btn({ children, onClick, primary, danger, small, disabled, style: sx }) {
  return <button onClick={disabled ? undefined : onClick} style={{ ...btnStyle({ primary, danger, small, disabled }), ...sx }}>{children}</button>;
}
