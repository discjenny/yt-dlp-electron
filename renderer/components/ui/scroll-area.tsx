import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../../lib/cn';

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewportClassName?: string;
  scrollbarClassName?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
};

export function ScrollArea({
  className,
  viewportClassName,
  scrollbarClassName,
  viewportRef,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative overflow-hidden group', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          'size-full overflow-y-auto overflow-x-hidden rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50',
          viewportClassName,
        )}
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className={cn(
          // Track area: invisible; slightly wider hit target
          'absolute right-0 top-0 w-2 mr-1 my-2 select-none touch-none transition-colors',
          'bg-transparent',
          scrollbarClassName,
        )}
      >
        <ScrollAreaPrimitive.Thumb
          className={cn(
            'relative w-[4px] flex-1 rounded-full',
            // Thumb shows blue/purple gradient based on position
            'bg-gradient-to-b from-blue-500/40 to-purple-500/40 shadow-sm',
          )}
        />
      </ScrollAreaPrimitive.Scrollbar>

      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export default ScrollArea;


