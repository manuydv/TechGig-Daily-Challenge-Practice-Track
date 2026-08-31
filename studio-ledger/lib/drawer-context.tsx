import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface DrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | undefined>(undefined);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // TEMPORARY diagnostic logging while chasing a "gets stuck" report —
  // remove once resolved.
  const openDrawer = useCallback(() => {
    console.log("[drawer-context] openDrawer");
    setOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    console.log("[drawer-context] closeDrawer");
    setOpen(false);
  }, []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer }), [open, openDrawer, closeDrawer]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be used within a DrawerProvider");
  return ctx;
}
