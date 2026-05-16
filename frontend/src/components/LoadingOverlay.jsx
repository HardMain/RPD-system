import { modalOverlay } from "../styles/index.js";
import { Spinner } from "./Spinner.jsx";

export function LoadingOverlay({ onClose, size = 28 }) {
  return <div style={modalOverlay} onMouseDown={onClose}><Spinner size={size} /></div>;
}
