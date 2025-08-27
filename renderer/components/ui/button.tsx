import * as React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
};

const base = 'inline-flex hover:cursor-pointer items-center justify-center whitespace-nowrap rounded text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const variants: Record<Variant, string> = {
  default: 'bg-card text-foreground hover:brightness-110 border border-border',
  secondary: 'bg-secondary text-foreground hover:brightness-110 border border-border',
  destructive: 'hover:bg-destructive/30 bg-destructive/10 text-destructive-foreground hover:brightness-110 border border-destructive/30',
  outline: 'bg-background/10 text-foreground hover:bg-card/50 border border-border',
};
const sizes = {
  sm: 'h-8 px-3',
  md: 'h-9 px-3',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
    );
  }
);
Button.displayName = 'Button';
