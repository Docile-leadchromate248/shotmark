import type { ReactElement } from 'react';
import { BaseIcon, type SvgIconProps } from './base';

export const IconMeasure = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <path
      d="M661 107L917 363L363 917L107 661Z"
      stroke="currentColor"
      strokeWidth="64"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M576 192L672 288" stroke="currentColor" strokeWidth="64" strokeLinecap="round" />
    <path d="M490 278L544 332" stroke="currentColor" strokeWidth="64" strokeLinecap="round" />
    <path d="M405 363L501 459" stroke="currentColor" strokeWidth="64" strokeLinecap="round" />
    <path d="M320 448L374 502" stroke="currentColor" strokeWidth="64" strokeLinecap="round" />
    <path d="M235 533L331 629" stroke="currentColor" strokeWidth="64" strokeLinecap="round" />
  </BaseIcon>
);
