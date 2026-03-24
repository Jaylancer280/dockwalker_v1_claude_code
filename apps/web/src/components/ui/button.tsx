import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-xs font-semibold tracking-[0.01em] whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-white hover:brightness-[1.08]',
        destructive:
          'bg-[var(--destructive)] text-white hover:brightness-[1.08] focus-visible:ring-destructive/20',
        outline:
          'bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--border-hi)] hover:text-[var(--foreground)]',
        secondary:
          'bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--border-hi)] hover:text-[var(--foreground)]',
        apply:
          'bg-[var(--accent-lo)] text-[var(--accent)] border border-[var(--border-hi)] hover:bg-[var(--accent)] hover:text-white uppercase tracking-[0.03em]',
        ghost: 'bg-transparent hover:bg-[var(--accent-lo)] text-[var(--muted-foreground)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
