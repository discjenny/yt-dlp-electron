import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../../lib/cn';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn('peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-accent/50', className)}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn('pointer-events-none block h-4 w-4 rounded-full bg-primary-foreground shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 translate-x-0')}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;
