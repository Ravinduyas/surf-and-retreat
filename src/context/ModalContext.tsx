import { createContext, useContext } from 'react';
import { BookingTab, DetailItem } from '../types';

export interface ModalContextValue {
  openBooking: (tab?: BookingTab, itemId?: string) => void;
  openVideo: () => void;
  openDetail: (item: DetailItem, bookingTab?: BookingTab) => void;
}

export const ModalContext = createContext<ModalContextValue>({
  openBooking: () => {},
  openVideo: () => {},
  openDetail: () => {},
});

export const useModals = () => useContext(ModalContext);
