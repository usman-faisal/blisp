import React from 'react';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: 'default' | 'compact' | 'none';
  grid?: boolean;
  containerClassName?: string;
  children: React.ReactNode;
}

const SPACING_CLASSES: Record<NonNullable<SectionProps['spacing']>, string> = {
  default: 'py-[clamp(80px,10vw,140px)]',
  compact: 'py-10 md:py-14',
  none: '',
};

export const Section: React.FC<SectionProps> = ({
  spacing = 'default',
  grid = false,
  className = '',
  containerClassName = '',
  children,
  ...rest
}) => {
  return (
    <section className={`${SPACING_CLASSES[spacing]} ${className}`} {...rest}>
      <div
        className={`w-full max-w-[1200px] mx-auto px-6 md:px-8 ${
          grid ? 'grid grid-cols-4 md:grid-cols-12 gap-6' : ''
        } ${containerClassName}`}
      >
        {children}
      </div>
    </section>
  );
};
