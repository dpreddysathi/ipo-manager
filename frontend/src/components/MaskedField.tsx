import { useEffect, useRef, useState } from 'react';

/**
 * Monospace masked value with an eye icon; reveal auto re-masks after
 * 10 seconds (spec §5).
 */
export function MaskedField({
  label,
  masked,
  revealed,
  onReveal,
  onHide,
}: {
  label: string;
  masked: string;
  revealed: string | null;
  onReveal: () => void;
  onHide: () => void;
}) {
  const [showing, setShowing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const toggle = () => {
    if (showing) {
      if (timer.current) window.clearTimeout(timer.current);
      setShowing(false);
      onHide();
    } else {
      onReveal();
      setShowing(true);
      timer.current = window.setTimeout(() => {
        setShowing(false);
        onHide();
      }, 10_000);
    }
  };

  return (
    <div className="masked-field">
      <span className="k">{label}</span>
      <span className="v">
        {showing && revealed ? revealed : masked}
        <button
          className="eye-btn"
          onClick={toggle}
          title={showing ? 'Hide (auto-hides in 10s)' : 'Reveal for 10 seconds'}
          aria-label={showing ? `Hide ${label}` : `Reveal ${label}`}
        >
          {showing ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </div>
  );
}
