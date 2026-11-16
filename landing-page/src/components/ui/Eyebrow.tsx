import React from 'react';

export interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: 'default' | 'teal' | 'amber';
  children: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<EyebrowProps['tone']>, string> = {
  default: 'text-[#5D5851] dark:text-[#A59D92]',
  teal: 'text-[#B54217] dark:text-[#E86F3F]',
  amber: 'text-[#7A5A12] dark:text-[#D6AB4E]',
};

export const Eyebrow: React.FC<EyebrowProps> = ({
  tone = 'default',
  className = '',
  children,
  ...rest
}) => {
  return (
    <p
      className={`text-[12px] font-semibold uppercase tracking-[0.16em] leading-snug ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </p>
  );
};
