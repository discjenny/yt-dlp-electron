import * as React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn('flex h-9 w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-none focus-visible:ring-0 ring-0', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';
