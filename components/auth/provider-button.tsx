import React from 'react';
import { Button } from '../ui/button';
import { signIn } from 'next-auth/react';

interface ProviderButtonProps {
  provider: string;
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

/**
 * Кнопка авторизации через провайдера, использующая встроенный метод signIn из NextAuth.js
 */
export function ProviderButton({ provider, icon, label, className }: ProviderButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Сохраняем текущий URL перед редиректом
    sessionStorage.setItem('preAuthUrl', window.location.href);
    // Определяем URL для обратного вызова - специальная страница на клиенте
    const callbackUrl = `${window.location.origin}/auth/callback`;
    // Используем встроенный метод signIn с указанием callbackUrl
    signIn(provider, { callbackUrl });
  };

  return (
    <Button 
      onClick={handleClick} 
      variant="outline" 
      className={className}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </Button>
  );
} 