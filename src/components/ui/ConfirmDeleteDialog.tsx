import { useState, useCallback, useRef } from 'react';
import { ConfirmDialog } from './confirm-dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' });
  const [target, setTarget] = useState<HTMLElement | React.MouseEvent | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions, triggerTarget?: HTMLElement | React.MouseEvent | null): Promise<boolean> => {
    setOptions(opts);
    setTarget(triggerTarget || (typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null));
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    if (resolverRef.current) resolverRef.current(true);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const dialogElement = (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={options.title}
      description={options.description}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant || 'destructive'}
      onConfirm={handleConfirm}
      target={target}
    />
  );

  return { confirm, dialogElement };
}
