import { ReactNode, useEffect } from "react";

/**
 * Windows 98 style primitives. Self-contained, no shadcn deps.
 * Color palette:
 *   #c0c0c0 — face (control / window background)
 *   #ffffff — top/left highlight
 *   #808080 — bottom/right shadow
 *   #000000 — outer dark border
 *   #dfdfdf — light inset
 *   #000080 — active title bar
 */

/* ───────── Raised border (buttons / window) ───────── */
const raised: React.CSSProperties = {
  borderStyle: "solid",
  borderWidth: 2,
  borderColor: "#ffffff #808080 #808080 #ffffff",
  boxShadow: "inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #000000",
  background: "#c0c0c0",
};

/* ───────── Sunken border (inputs / inner panels) ───────── */
const sunken: React.CSSProperties = {
  borderStyle: "solid",
  borderWidth: 2,
  borderColor: "#808080 #ffffff #ffffff #808080",
  boxShadow: "inset 1px 1px 0 #000000, inset -1px -1px 0 #dfdfdf",
  background: "#ffffff",
};

/* ───────── Button ───────── */
export function Win98Button({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
  title,
  asChild = false,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
  asChild?: boolean;
}) {
  const cls =
    "inline-flex items-center justify-center min-w-[72px] px-3 h-7 text-[12px] text-black select-none " +
    "font-[Tahoma,'MS_Sans_Serif',sans-serif] active:[box-shadow:inset_1px_1px_0_#000,inset_-1px_-1px_0_#dfdfdf] " +
    "active:[border-color:#808080_#ffffff_#ffffff_#808080] disabled:text-[#808080] " +
    className;
  if (asChild) {
    return (
      <span className={cls} style={raised} title={title}>
        {children}
      </span>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title} className={cls} style={raised}>
      {children}
    </button>
  );
}

/* ───────── Input ───────── */
export function Win98Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string },
) {
  const { className = "", style, ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full px-1.5 h-6 text-[12px] text-black outline-none font-[Tahoma,'MS_Sans_Serif',sans-serif] " +
        className
      }
      style={{ ...sunken, ...style }}
    />
  );
}

export function Win98Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string },
) {
  const { className = "", style, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={
        "w-full px-1.5 py-1 text-[12px] text-black outline-none font-[Tahoma,'MS_Sans_Serif',sans-serif] " +
        className
      }
      style={{ ...sunken, resize: "vertical", ...style }}
    />
  );
}

/* ───────── Group box (fieldset with sunken border + label) ───────── */
export function Win98GroupBox({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={"px-3 pt-2 pb-3 mb-3 text-black " + className}
      style={{
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#808080 #ffffff #ffffff #808080",
        background: "transparent",
      }}
    >
      <legend className="px-1 text-[12px] font-[Tahoma,'MS_Sans_Serif',sans-serif]">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

/* ───────── Label ───────── */
export function Win98Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[12px] text-black mb-0.5 font-[Tahoma,'MS_Sans_Serif',sans-serif]"
    >
      {children}
    </label>
  );
}

/* ───────── Window shell (modal) ───────── */
export function Win98Window({
  open,
  title,
  onClose,
  children,
  width = "min(960px,95vw)",
  height = "min(85vh,860px)",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  height?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div
        className="flex flex-col text-black font-[Tahoma,'MS_Sans_Serif',sans-serif]"
        style={{ ...raised, width, height }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between text-white px-1.5 py-1 select-none"
          style={{
            background:
              "linear-gradient(90deg,#000080 0%,#1084d0 100%)",
          }}
        >
          <span className="text-[12px] font-bold tracking-wide">{title}</span>
          <div className="flex gap-0.5">
            <button
              onClick={onClose}
              aria-label="关闭"
              className="w-[18px] h-[16px] flex items-center justify-center text-black text-[11px] font-bold leading-none active:[box-shadow:inset_1px_1px_0_#000,inset_-1px_-1px_0_#dfdfdf] active:[border-color:#808080_#ffffff_#ffffff_#808080]"
              style={raised}
            >
              ×
            </button>
          </div>
        </div>
        {/* Menu strip (cosmetic) */}
        <div
          className="px-1.5 py-[2px] text-[12px] select-none"
          style={{ background: "#c0c0c0", borderBottom: "1px solid #808080" }}
        >
          <span className="px-1">文件(F)</span>
          <span className="px-1">编辑(E)</span>
          <span className="px-1">查看(V)</span>
          <span className="px-1">帮助(H)</span>
        </div>
        {/* Body */}
        <div
          className="flex-1 overflow-auto p-3 win98-scroll"
          style={{ background: "#c0c0c0" }}
        >
          {children}
        </div>
        {/* Status bar */}
        <div
          className="flex items-center px-2 py-[3px] text-[11px] text-black"
          style={{
            background: "#c0c0c0",
            borderTop: "1px solid #ffffff",
          }}
        >
          <div
            className="px-2 py-[1px]"
            style={{
              borderStyle: "solid",
              borderWidth: 1,
              borderColor: "#808080 #ffffff #ffffff #808080",
            }}
          >
            就绪
          </div>
        </div>
      </div>
      {/* Scrollbar styling — Win98 chunky */}
      <style>{`
        .win98-scroll::-webkit-scrollbar { width: 16px; height: 16px; }
        .win98-scroll::-webkit-scrollbar-track {
          background:
            repeating-conic-gradient(#c0c0c0 0% 25%, #dfdfdf 0% 50%) 50% / 2px 2px;
        }
        .win98-scroll::-webkit-scrollbar-thumb {
          background: #c0c0c0;
          border: 2px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #000;
        }
        .win98-scroll::-webkit-scrollbar-button:single-button {
          background: #c0c0c0;
          height: 16px; width: 16px;
          border: 2px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #000;
          display: block;
        }
      `}</style>
    </div>
  );
}

export const win98Styles = { raised, sunken };
