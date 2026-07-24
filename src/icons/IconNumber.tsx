import type { ReactElement } from 'react';
import { BaseIcon, type SvgIconProps } from './base';

export const IconNumber = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <circle cx="512" cy="512" r="352" stroke="currentColor" strokeWidth="64" fill="none" />
    <path
      d="M512 356v330"
      stroke="currentColor"
      strokeWidth="72"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M468 408l44-52"
      stroke="currentColor"
      strokeWidth="72"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M450 700h124"
      stroke="currentColor"
      strokeWidth="64"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </BaseIcon>
);
