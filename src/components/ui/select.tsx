import React from 'react';
import { Select as ArcoSelect } from '@arco-design/web-react';
import type { SelectProps as ArcoSelectProps } from '@arco-design/web-react';
import { cn } from '@/lib/utils';
import '@arco-design/web-react/dist/css/arco.css';

export interface SelectProps extends ArcoSelectProps {
  className?: string;
}

export const Select: React.ForwardRefExoticComponent<
  SelectProps & React.RefAttributes<any>
> & {
  Option: typeof ArcoSelect.Option;
  OptGroup: typeof ArcoSelect.OptGroup;
} = Object.assign(
  React.forwardRef<any, SelectProps>(({ className, ...props }, ref) => {
    return (
      <ArcoSelect
        ref={ref}
        className={cn(
          '!bg-white dark:!bg-card !border !border-border !rounded-none !text-foreground shadow-2xs hover:!border-primary/60 focus:!border-primary transition-colors',
          '[&_.arco-select-view]:!bg-white dark:[&_.arco-select-view]:!bg-card [&_.arco-select-view]:!border-0 [&_.arco-select-view]:!rounded-none',
          className
        )}
        {...props}
      />
    );
  }),
  {
    Option: ArcoSelect.Option,
    OptGroup: ArcoSelect.OptGroup,
  }
);

export const Option = ArcoSelect.Option;
export const OptGroup = ArcoSelect.OptGroup;

export type { ArcoSelectProps };
