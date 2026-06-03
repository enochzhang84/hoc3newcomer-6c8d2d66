import { ReactNode, useEffect, useState, useCallback } from "react";

/**
 * Win98 style modal — used for confirm / alert prompts inside the home
 * page settings panel. Self-contained, no external deps.
 */

type Win98DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "info" | "warn" | "error" | "success";
};

const ICONS: Record<string, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
  success: "✅",
};

export function Win98Dialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = "确定",
  cancelText = "取消",
  variant = "info",
}: Win98DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30">
      <div
        className="min-w-[320px] max-w-md bg-[#c0c0c0] text-black font-sans shadow-[2px_2px_0_#000]"
        style={{
          border: "2px solid",
          borderColor: "#ffffff #808080 #808080 #ffffff",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between bg-[#000080] text-white px-2 py-1 select-none">
          <span className="text-sm font-bold">{title}</span>
          <button
            onClick={onClose}
            className="bg-[#c0c0c0] text-black w-5 h-5 leading-none text-xs font-bold flex items-center justify-center"
            style={{ border: "1px solid", borderColor: "#ffffff #808080 #808080 #ffffff" }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="p-4 flex items-start gap-3 text-sm">
          <div className="text-2xl leading-none">{ICONS[variant]}</div>
          <div className="flex-1 whitespace-pre-wrap break-words">{children}</div>
        </div>
        {/* Buttons */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          {onConfirm && (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="min-w-[72px] px-3 py-1 text-sm bg-[#c0c0c0] active:translate-x-px active:translate-y-px"
              style={{ border: "2px solid", borderColor: "#ffffff #808080 #808080 #ffffff" }}
            >
              {confirmText}
            </button>
          )}
          <button
            onClick={onClose}
            className="min-w-[72px] px-3 py-1 text-sm bg-[#c0c0c0] active:translate-x-px active:translate-y-px"
            style={{ border: "2px solid", borderColor: "#ffffff #808080 #808080 #ffffff" }}
          >
            {onConfirm ? cancelText : "确定"}
          </button>
        </div>
      </div>
    </div>
  );
}

type DialogState = {
  title: string;
  message: ReactNode;
  variant?: "info" | "warn" | "error" | "success";
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
};

export function useWin98Dialog() {
  const [state, setState] = useState<DialogState | null>(null);

  const alert = useCallback(
    (title: string, message: ReactNode, variant: DialogState["variant"] = "info") =>
      setState({ title, message, variant }),
    [],
  );

  const confirm = useCallback(
    (title: string, message: ReactNode, onConfirm: () => void, variant: DialogState["variant"] = "warn") =>
      setState({ title, message, variant, onConfirm, confirmText: "确定", cancelText: "取消" }),
    [],
  );

  const close = useCallback(() => setState(null), []);

  const dialog = (
    <Win98Dialog
      open={!!state}
      title={state?.title ?? ""}
      onClose={close}
      onConfirm={state?.onConfirm}
      variant={state?.variant}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
    >
      {state?.message}
    </Win98Dialog>
  );

  // suppress unused warning if React strict cares
  useEffect(() => undefined, []);

  return { alert, confirm, dialog };
}