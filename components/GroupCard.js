import { useRef } from "react";
import {
  formatBalance,
  formatCurrencyCompact,
  getStandingCopy,
} from "../lib/utils";

function FourSquaresIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="4" y="4" width="6" height="6" rx="1.4" />
      <rect x="14" y="4" width="6" height="6" rx="1.4" />
      <rect x="4" y="14" width="6" height="6" rx="1.4" />
      <rect x="14" y="14" width="6" height="6" rx="1.4" />
    </svg>
  );
}

const LONG_PRESS_MS = 320;

export default function GroupCard({
  group,
  onClick,
  onPreview,
  onColorChange,
  collapsed = false,
  isTopCard = false,
}) {
  const colorInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);
  const standingCopy = getStandingCopy(group.balance);

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function stopCardOpen(event) {
    event.stopPropagation();
    clearLongPressTimer();
  }

  function handleColorButtonClick(event) {
    event.stopPropagation();
    colorInputRef.current?.click();
  }

  function handleColorInputChange(event) {
    event.stopPropagation();
    onColorChange?.(group, event.target.value);
  }

  function handlePointerDown() {
    clearLongPressTimer();
    didLongPressRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      onPreview?.(group);
    }, LONG_PRESS_MS);
  }

  function handlePointerEnd() {
    clearLongPressTimer();
  }

  function handleOpen() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    onClick?.(group);
  }

  return (
    <div
      className="group relative w-full overflow-hidden rounded-[28px] border border-white/50 text-left text-white shadow-[0_8px_20px_rgba(28,25,23,0.08),0_20px_40px_rgba(28,25,23,0.12)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.995]"
      style={{ backgroundColor: group.cardColor }}
    >
      <button
        type="button"
        onClick={handleOpen}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        className="absolute inset-0 z-10 rounded-[28px]"
        aria-label={`Open ${group.name}`}
      />

      {group.cardImage ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${group.cardImage})` }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-0 bg-[rgba(28,25,23,0.18)]" />

      {group.needsAttention ? (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-[#0070F3] shadow-[0_0_0_4px_rgba(255,255,255,0.18)]" />
      ) : null}

      <div className={`relative z-20 aspect-[3.375/2.28] w-full ${collapsed ? "px-5 pt-3 pb-6" : "px-6 pt-5 pb-9"} pointer-events-none`}>
        {collapsed ? (
          <div className="flex h-[56px] items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className="min-w-0 truncate text-[18px] font-semibold leading-none tracking-[-0.04em] text-white"
                style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
              >
                {group.name}
              </h3>
              <div className="mt-1 truncate text-[11px] font-medium leading-none text-white/82">
                {group.memberPreview || "Just you for now"}
              </div>
            </div>

            <div className={`shrink-0 pt-0.5 text-right ${group.needsAttention ? "pr-4" : ""}`}>
              <div className="text-[16px] font-semibold leading-none tracking-[-0.03em] text-white">
                {formatCurrencyCompact(group.totalSpent)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3
                  className="max-w-[190px] text-[31px] font-semibold leading-[0.94] tracking-[-0.04em] text-white"
                  style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
                >
                  {group.name}
                </h3>
                <p className="mt-3 max-w-[220px] truncate text-[14px] font-normal text-white/85">
                  {group.memberPreview || "Just you for now"}
                </p>
              </div>

              <div className={`pt-1 text-right ${group.needsAttention ? "pr-5" : ""}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65 transition-opacity duration-200">
                  Total
                </div>
                <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-white">
                  {formatCurrencyCompact(group.totalSpent)}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/72">
                  {standingCopy}
                </div>
                <div className="mt-2 text-[38px] font-bold leading-none tracking-[-0.06em] text-white">
                  {formatBalance(group.balance)}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  {isTopCard ? (
                    <>
                      <button
                        type="button"
                        onPointerDown={stopCardOpen}
                        onClick={handleColorButtonClick}
                        className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full border border-white/35 bg-white/14 px-3 text-[12px] font-semibold tracking-[0.02em] text-white/92 transition hover:border-[#5F7D6A] hover:bg-[#5F7D6A] hover:text-white active:scale-[0.96]"
                        aria-label={`Change ${group.name} card color`}
                      >
                        <FourSquaresIcon />
                        <span>Color</span>
                      </button>
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={group.cardColor}
                        onChange={handleColorInputChange}
                        className="pointer-events-none sr-only"
                        tabIndex={-1}
                      />
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 text-[12px] font-medium leading-[1.2] text-white/82">
                <div className="truncate">
                  {group.expenseCount} {group.expenseCount === 1 ? "expense" : "expenses"} • code {group.code}
                </div>
                <div className="shrink-0">{group.membersCount} members</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
