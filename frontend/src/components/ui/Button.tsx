import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-300',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
  ghost: 'text-gray-600 hover:bg-gray-100 disabled:text-gray-300',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 gap-1 px-2.5 text-xs',
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'sm' | 'md';
  variant?: 'outline' | 'ghost' | 'solid';
}

export function IconButton({ size = 'md', variant = 'outline', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        variant === 'outline' && 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        variant === 'ghost' && 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        variant === 'solid' && 'bg-neutral-900 text-white hover:bg-neutral-700',
        className,
      )}
      {...rest}
    />
  );
}
