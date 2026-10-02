import { createContext, useContext } from 'react';
import type { ScreenName, ScreenState } from './types';

export interface NavContextValue {
  screen: ScreenState;
  navigate: (name: ScreenName, params?: Record<string, string>) => void;
  back: () => void;
  logout: () => void;
  switchProperty: () => void;
}

export const NavContext = createContext<NavContextValue | null>(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavContext');
  return ctx;
}
