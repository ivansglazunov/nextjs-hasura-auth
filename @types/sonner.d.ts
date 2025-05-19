declare module 'sonner' {
  import * as React from 'react';
  
  export type ToastTypes = 'success' | 'error' | 'info' | 'warning' | 'default';
  
  export interface ToastProps {
    id?: number | string;
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    icon?: React.ReactNode;
    duration?: number;
    dismissible?: boolean;
    className?: string;
    style?: React.CSSProperties;
    actionButtonStyle?: React.CSSProperties;
    type?: ToastTypes;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    action?: {
      label: string;
      onClick: () => void;
    };
    onDismiss?: () => void;
    onAutoClose?: (id: number | string) => void;
  }
  
  export interface ToasterProps {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    hotkey?: string[];
    expand?: boolean;
    richColors?: boolean;
    duration?: number;
    visibleToasts?: number;
    closeButton?: boolean;
    theme?: 'light' | 'dark' | 'system';
    style?: React.CSSProperties;
    className?: string;
    toastOptions?: ToastProps;
    offset?: string | number;
    dir?: 'auto' | 'ltr' | 'rtl';
  }
  
  export interface Toast {
    id: number | string;
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    type?: ToastTypes;
    icon?: React.ReactNode;
    duration?: number;
    dismissible?: boolean;
    onDismiss?: (id: number | string) => void;
    onAutoClose?: (id: number | string) => void;
    promise?: Promise<any>;
    cancelButtonStyle?: React.CSSProperties;
    action?: {
      label: string;
      onClick: () => void;
    };
    cancel?: {
      label: string;
      onClick: () => void;
    };
    style?: React.CSSProperties;
    className?: string;
    descriptionClassName?: string;
  }

  export type ExternalToast = Omit<Toast, 'id'>;
  
  export interface ToastT {
    (message: string | React.ReactNode, data?: ExternalToast): string | number;
    success: (message: string | React.ReactNode, data?: ExternalToast) => string | number;
    error: (message: string | React.ReactNode, data?: ExternalToast) => string | number;
    info: (message: string | React.ReactNode, data?: ExternalToast) => string | number;
    warning: (message: string | React.ReactNode, data?: ExternalToast) => string | number;
    promise: <T>(
      promise: Promise<T> | (() => Promise<T>),
      options: {
        loading: string | React.ReactNode;
        success: string | React.ReactNode | ((data: T) => string | React.ReactNode);
        error: string | React.ReactNode | ((error: any) => string | React.ReactNode);
      },
      data?: ExternalToast
    ) => Promise<T>;
    dismiss: (id?: number | string) => void;
    custom: (jsx: (id: number | string) => React.ReactNode, data?: ExternalToast) => number | string;
  }
  
  export const toast: ToastT;
  export const Toaster: React.FC<ToasterProps>;
}
