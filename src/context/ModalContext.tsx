import { createContext, useContext } from 'react';

export interface ModalContextValue {
  openVideo: () => void;
}

export const ModalContext = createContext<ModalContextValue>({
  openVideo: () => {},
});

export const useModals = () => useContext(ModalContext);
