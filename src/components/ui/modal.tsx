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

    return (
      <ArcoModal
        visible={isVisible}
        okButtonProps={mergedOkButtonProps}
        style={mergedStyle}
        className={cn(
          isPixelTheme &&
            "[&_.arco-modal]:!rounded-xs [&_.arco-modal]:!border-2 [&_.arco-modal]:!border-border [&_.arco-modal]:!shadow-[4px_4px_0px_#000] [&_.arco-modal]:!font-mono [&_.arco-modal-header]:!border-b-2 [&_.arco-modal-footer]:!border-t-2 [&_.arco-modal-title]:!font-mono [&_.arco-btn]:!rounded-xs [&_.arco-btn]:!font-mono [&_.arco-btn]:!border [&_.arco-btn-primary]:!bg-amber-500 [&_.arco-btn-primary]:!text-amber-950 [&_.arco-btn-primary]:!font-bold [&_.arco-btn-primary]:!shadow-[2px_2px_0px_#000]",
          className
        )}
        {...rest}
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
