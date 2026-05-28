import { useRef, useState } from "react";
import { T, F, SH } from "../../styles/index.js";
import { Avatar } from "../../components/Avatar.jsx";
import { useDismiss } from "../../hooks/useDismiss.js";
import { userCan } from "../../api/client.js";
import { KeyIcon, LogoutIcon, InfoIcon, GearIcon, ThemeIcon, ChevronDownIcon, SparkleIcon, BuildingIcon } from "../../components/icons.jsx";

export function AccountMenu({ user, onOpenProfile, onLogout }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapRef = useRef(null);
  useDismiss(open, () => setOpen(false), wrapRef);
  const isAdmin = userCan(user, "*");
  const canManageOrg = isAdmin || userCan(user, "users.create");

  const go = (section) => { setOpen(false); onOpenProfile(section); };

  return <div ref={wrapRef} style={{ position: "relative" }}>
    <button
      onClick={() => setOpen(o => !o)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        border: "none", borderRadius: 999,
        background: (open || hover) ? T.headerChipHover : T.headerChip,
        color: T.headerText, cursor: "pointer",
        padding: "4px 12px 4px 4px", fontFamily: F,
        transition: "background .15s",
      }}>
      <Avatar user={user} size={30} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</span>
        <span style={{ fontSize: 11, opacity: .65 }}>{user.role}</span>
      </span>
      <span style={{ opacity: .7, display: "flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><ChevronDownIcon /></span>
    </button>

    {open && <div style={popupStyle}>
      <div style={headerBox}>
        <Avatar user={user} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.full_name}</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>{user.role}</div>
          {user.email && <div style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
        </div>
      </div>

      <div style={{ padding: 6, borderTop: "1px solid " + T.borderLight }}>
        <MenuItem icon={<GearIcon size={16} />} label="Профиль и настройки" onClick={() => go("profile")} />
        <MenuItem icon={<KeyIcon size={16} />} label="Сменить пароль" onClick={() => go("security")} />
        <MenuItem icon={<ThemeIcon size={16} />} label="Внешний вид" onClick={() => go("appearance")} />
        {canManageOrg && <MenuItem icon={<BuildingIcon size={16} />} label="Организация" onClick={() => go("organization")} />}
        <MenuItem icon={<InfoIcon size={16} />} label="Системная информация" onClick={() => go("system")} />
        {isAdmin && <MenuItem icon={<SparkleIcon />} label="Языковая модель" onClick={() => go("llm")} />}
      </div>
      <div style={{ padding: 6, borderTop: "1px solid " + T.borderLight }}>
        <MenuItem icon={<LogoutIcon size={16} />} label="Выйти" danger onClick={() => { setOpen(false); onLogout(); }} />
      </div>
    </div>}
  </div>;
}

function MenuItem({ icon, label, onClick, danger }) {
  const [h, setH] = useState(false);
  return <button
    onClick={onClick}
    onMouseEnter={() => setH(true)}
    onMouseLeave={() => setH(false)}
    style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "9px 10px", border: "none", borderRadius: 6,
      background: h ? (danger ? T.redBg : T.bg) : "transparent",
      color: danger ? T.red : T.text,
      cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 500, textAlign: "left",
    }}>
    <span style={{ display: "flex", color: danger ? T.red : T.textMuted }}>{icon}</span>
    {label}
  </button>;
}

const popupStyle = {
  position: "absolute", top: "calc(100% + 8px)", right: 0,
  width: 280, background: T.surface,
  border: "1px solid " + T.border, borderRadius: 10,
  boxShadow: SH.dropdown, zIndex: 999,
  overflow: "hidden",
};

const headerBox = {
  display: "flex", alignItems: "center", gap: 12,
  padding: 16, fontFamily: F,
};
