import React from 'react';
import { Modal as ArcoModal } from '@arco-design/web-react';
import type { ModalProps as ArcoModalProps } from '@arco-design/web-react';
import { useAppThemeStyle } from '@/hooks/useAppThemeStyle';
import { cn } from '@/lib/utils';
import '@arco-design/web-react/dist/css/arco.css';

export interface ModalProps extends Omit<ArcoModalProps, 'style'> {
  open?: boolean;
  okDisabled?: boolean;
  width?: number | string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> & {
  confirm: typeof ArcoModal.confirm;
  info: typeof ArcoModal.info;
  success: typeof ArcoModal.success;
  warning: typeof ArcoModal.warning;
  error: typeof ArcoModal.error;
  useModal: typeof ArcoModal.useModal;
} = Object.assign(
  ({
    open,
    visible,
    okDisabled,
    okButtonProps,
    width,
    style,
    className,
    ...rest
  }: ModalProps) => {
    const { isPixelTheme } = useAppThemeStyle();
    const isVisible = visible ?? open ?? false;
    const mergedOkButtonProps = {
      ...okButtonProps,
      ...(okDisabled !== undefined ? { disabled: okDisabled } : {}),
    };
    const mergedStyle: React.CSSProperties = {
      ...style,
      ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    };

    const { getChildrenPopupContainer, ...modalRest } = rest as any;

    return (
      <ArcoModal
        visible={isVisible}
        okButtonProps={mergedOkButtonProps}
        style={mergedStyle}
        getChildrenPopupContainer={getChildrenPopupContainer || (() => document.body)}
        className={cn(
          isPixelTheme &&
            "[&_.arco-modal]:!rounded-xs [&_.arco-modal]:!border-2 [&_.arco-modal]:!border-border [&_.arco-modal]:!shadow-[5px_5px_0px_#000] [&_.arco-modal]:!font-mono [&_.arco-modal]:!bg-card [&_.arco-modal-header]:!border-b-2 [&_.arco-modal-header]:!border-border [&_.arco-modal-header]:!bg-amber-50/60 dark:[&_.arco-modal-header]:!bg-amber-950/40 [&_.arco-modal-footer]:!border-t-2 [&_.arco-modal-footer]:!border-border [&_.arco-modal-footer]:!bg-amber-50/30 dark:[&_.arco-modal-footer]:!bg-amber-950/20 [&_.arco-modal-title]:!font-mono [&_.arco-modal-title]:!font-bold [&_.arco-modal-content]:!font-mono [&_.arco-btn]:!rounded-xs [&_.arco-btn]:!font-mono [&_.arco-btn-primary]:!bg-amber-500 hover:[&_.arco-btn-primary]:!bg-amber-600 [&_.arco-btn-primary]:!text-amber-950 [&_.arco-btn-primary]:!font-bold [&_.arco-btn-primary]:!border-2 [&_.arco-btn-primary]:!border-amber-900 [&_.arco-btn-primary]:!shadow-[2px_2px_0px_#000] active:[&_.arco-btn-primary]:!translate-x-[1px] active:[&_.arco-btn-primary]:!translate-y-[1px] active:[&_.arco-btn-primary]:!shadow-none [&_.arco-btn-secondary]:!bg-muted/60 hover:[&_.arco-btn-secondary]:!bg-muted [&_.arco-btn-secondary]:!border-2 [&_.arco-btn-secondary]:!border-border [&_.arco-btn-secondary]:!shadow-[1px_1px_0px_#000]",
          className
        )}
        {...modalRest}
      />
    );
  },
  {
    confirm: ArcoModal.confirm,
    info: ArcoModal.info,
    success: ArcoModal.success,
    warning: ArcoModal.warning,
    error: ArcoModal.error,
    useModal: ArcoModal.useModal,
  }
);

export type { ArcoModalProps };
