import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

type AnchorButtonProps = BaseButtonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseButtonProps> & {
    href: string;
  };

type NativeButtonProps = BaseButtonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps> & {
    href?: undefined;
  };

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#C64A1B] text-white font-semibold border border-[#AD3E14]/30 ' +
    'shadow-[0_10px_24px_-6px_rgba(198,74,27,0.42),inset_0_1px_0_rgba(255,255,255,0.26)] ' +
    'hover:bg-[#D45322] hover:shadow-[0_14px_28px_-6px_rgba(198,74,27,0.52),inset_0_1px_0_rgba(255,255,255,0.34)] ' +
    'dark:bg-[#E86F3F] dark:text-[#141210] dark:hover:bg-[#F07E51]',
  secondary:
    'bg-[#EFEBE2]/90 dark:bg-[#201C18]/90 text-[#1C1815] dark:text-[#F5F2EC] font-medium ' +
    'border border-[#322C25]/12 dark:border-[#F5F2EC]/14 backdrop-blur-md ' +
    'shadow-[0_4px_16px_-6px_rgba(50,44,37,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] ' +
    'dark:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.05)] ' +
    'hover:bg-[#E9E2D8] dark:hover:bg-[#2A241F]',
  ghost:
    'bg-transparent text-[#5D5851] dark:text-[#C5BDB2] font-medium border border-transparent ' +
    'hover:bg-[#322C25]/[0.06] dark:hover:bg-[#F5F2EC]/[0.07] hover:text-[#1C1815] dark:hover:text-[#F5F2EC]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4 py-2 text-[13.5px] rounded-full gap-2',
  md: 'min-h-[44px] px-5 py-2.5 text-[14.5px] rounded-full gap-2',
  lg: 'min-h-[50px] px-6 py-3 text-[15.5px] rounded-full gap-2.5',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center whitespace-nowrap shrink-0 select-none ' +
  'transition-[transform,opacity,background-color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DF5F2C] dark:focus-visible:ring-[#E86F3F] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#F5F2EC] dark:focus-visible:ring-offset-[#141210] ' +
  'disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none';

export const Button: React.FC<ButtonProps> = (props) => {
  const {
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled = false,
  } = props;

  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;

  if ('href' in props && props.href !== undefined) {
    const {
      href,
      variant: _v,
      size: _s,
      leftIcon: _li,
      rightIcon: _ri,
      children: _c,
      className: _cn,
      disabled: _d,
      ...anchorProps
    } = props;

    return (
      <a
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        className={`${classes} ${disabled ? 'opacity-45 pointer-events-none' : ''}`}
        {...anchorProps}
      >
        {leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
      </a>
    );
  }

  const {
    type = 'button',
    variant: _v,
    size: _s,
    leftIcon: _li,
    rightIcon: _ri,
    children: _c,
    className: _cn,
    disabled: _d,
    ...buttonProps
  } = props;

  return (
    <button type={type} disabled={disabled} className={classes} {...buttonProps}>
      {leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
    </button>
  );
};
