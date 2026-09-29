import React, { createContext, useCallback, useContext, useState } from 'react';

export interface DrawerSelection {
  personId: number;
  /** When set, the drawer is scoped to this IPO; otherwise "all IPOs" mode. */
  ipoId?: number;
}

interface DrawerCtx {
  openDrawer: (sel: DrawerSelection) => void;
  closeDrawer: () => void;
  selection: DrawerSelection | null;
  visible: boolean;
}

const Ctx = createContext<DrawerCtx>({
  openDrawer: () => {},
  closeDrawer: () => {},
  selection: null,
  visible: false,
});

export const useDrawer = () => useContext(Ctx);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<DrawerSelection | null>(null);
  const [visible, setVisible] = useState(false);

  const openDrawer = useCallback((sel: DrawerSelection) => {
    setSelection(sel);
    // Double rAF so the slide-in transition runs on mount.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true)),
    );
  }, []);

  const closeDrawer = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setSelection(null), 260);
  }, []);

  return (
    <Ctx.Provider value={{ openDrawer, closeDrawer, selection, visible }}>
      {children}
    </Ctx.Provider>
  );
}
