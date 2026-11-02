import { useState, useEffect, useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import { animateModalEnter, animateModalExit } from '../motion/transitions';

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export function ModalDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children
}: ModalDialogProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef<boolean>(false);

  const { contextSafe } = useGSAP({ scope: containerRef });

  const triggerClose = useCallback(
    contextSafe(() => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      animateModalExit(backdropRef.current, cardRef.current, () => {
        isClosingRef.current = false;
        setIsRendered(false);
        onClose();
      });
    }),
    [contextSafe, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setIsRendered(true);
    } else if (isRendered && !isClosingRef.current) {
      triggerClose();
    }
  }, [isOpen, isRendered, triggerClose]);

  useGSAP(
    () => {
      if (isRendered && !isClosingRef.current && backdropRef.current && cardRef.current) {
        animateModalEnter(backdropRef.current, cardRef.current);
      }
    },
    { dependencies: [isRendered], scope: containerRef }
  );

  useEffect(() => {
    if (!isRendered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        triggerClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, triggerClose]);

  if (!isRendered) return null;

  return (
    <div ref={containerRef} className="modal-root">
      <div
        ref={backdropRef}
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === backdropRef.current) {
            triggerClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div ref={cardRef} className="modal-content">
          <h3 className="modal-title">{title}</h3>
          {subtitle && (
            <div className="modal-subtitle">
              {subtitle}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

