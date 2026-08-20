import React from 'react';
import { Select as ArcoSelect } from '@arco-design/web-react';
import type { SelectProps as ArcoSelectProps } from '@arco-design/web-react';
import { useAppThemeStyle } from '@/hooks/useAppThemeStyle';
import { cn } from '@/lib/utils';
import '@arco-design/web-react/dist/css/arco.css';

export interface SelectProps extends ArcoSelectProps {
  className?: string;
  dropdownMenuClassName?: string;
}

export const Select: React.ForwardRefExoticComponent<
  SelectProps & React.RefAttributes<any>
> & {
  Option: typeof ArcoSelect.Option;
  OptGroup: typeof ArcoSelect.OptGroup;
} = Object.assign(
  React.forwardRef<any, SelectProps>(({ className, dropdownMenuClassName, ...props }, ref) => {
    const { isPixelTheme } = useAppThemeStyle();

    const mergedTriggerProps = {
      zIndex: 1100,
      ...(props.triggerProps as any),
    };

    return (
      <ArcoSelect
        ref={ref}
        getPopupContainer={props.getPopupContainer || (() => document.body)}
        triggerProps={mergedTriggerProps}
        className={cn(
          isPixelTheme
            ? '!rounded-xs !border-2 !border-border !bg-muted/60 hover:!bg-muted !text-foreground !font-mono !shadow-[1px_1px_0px_#000] focus:!border-amber-600 focus:!bg-background transition-colors [&_.arco-select-view]:!bg-transparent [&_.arco-select-view]:!border-0 [&_.arco-select-view]:!rounded-xs [&_.arco-select-view]:!font-mono [&_.arco-select-view-value]:!text-foreground [&_.arco-select-view-icon]:!text-muted-foreground'
            : '!bg-background !border !border-border/80 !rounded-lg !text-foreground shadow-2xs hover:!border-primary/60 focus:!border-primary transition-colors [&_.arco-select-view]:!bg-background [&_.arco-select-view]:!border-0 [&_.arco-select-view]:!rounded-lg [&_.arco-select-view-value]:!text-foreground',
          className
        )}
        dropdownMenuClassName={cn(
          isPixelTheme
            ? '!rounded-xs !border-2 !border-border !bg-popover !text-popover-foreground !font-mono !shadow-[3px_3px_0px_#000] [&_.arco-select-option]:!rounded-xs [&_.arco-select-option]:!font-mono [&_.arco-select-option-selected]:!bg-accent [&_.arco-select-option-selected]:!text-foreground [&_.arco-select-option:hover]:!bg-muted'
            : '!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-lg [&_.arco-select-option]:!rounded-lg [&_.arco-select-option-selected]:!bg-accent [&_.arco-select-option:hover]:!bg-muted',
          dropdownMenuClassName
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

