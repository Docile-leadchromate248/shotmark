import type { ReactElement, SVGProps } from 'react';

export type SvgIconProps = SVGProps<SVGSVGElement>;

export const BaseIcon = ({ children, ...props }: SvgIconProps): ReactElement => (
  <svg
    viewBox="0 0 1024 1024"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const FillPath = ({
  d,
  fillRule = 'evenodd',
}: {
  d: string;
  fillRule?: 'evenodd' | 'nonzero';
}): ReactElement => <path d={d} fill="currentColor" fillRule={fillRule} />;
