import { T } from "../theme.js";

export function Spinner({ size = 20 }) {
  return <div style={{ width: size, height: size, border: "3px solid " + T.borderLight, borderTop: "3px solid " + T.accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} />;
}
