import * as React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn('flex h-9 w-full rounded-md border border-[var(--border)] bg-[#0e0f14] px-3 py-2 text-sm text-[var(--fg)] outline-none focus-visible:ring-2 focus-visible:ring-[#69a9ff33]', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';
