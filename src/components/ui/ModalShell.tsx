import React, { useEffect } from 'react';

interface ModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  cardClassName?: string;
  overlayClassName?: string;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  onClose,
  children,
  cardClassName = 'relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden border border-[#DCE2D8] shadow-2xl',
  overlayClassName = 'bg-black/60 backdrop-blur-xs',
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 modal-fade ${overlayClassName}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={cardClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};
