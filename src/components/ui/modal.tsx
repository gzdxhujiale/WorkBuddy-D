import React from 'react';
import { Modal as ArcoModal } from '@arco-design/web-react';
import type { ModalProps as ArcoModalProps } from '@arco-design/web-react';
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
    ...rest
  }: ModalProps) => {
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
