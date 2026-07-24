import type { ReactElement } from 'react';
import { BaseIcon, type SvgIconProps } from './base';

export const IconMosaic = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <rect
      x="192"
      y="192"
      width="640"
      height="640"
      rx="48"
      stroke="currentColor"
      strokeWidth="56"
      fill="none"
    />
    <rect x="192" y="192" width="160" height="160" fill="currentColor" />
    <rect x="512" y="192" width="160" height="160" fill="currentColor" />
    <rect x="352" y="352" width="160" height="160" fill="currentColor" />
    <rect x="672" y="352" width="160" height="160" fill="currentColor" />
    <rect x="192" y="512" width="160" height="160" fill="currentColor" />
    <rect x="512" y="512" width="160" height="160" fill="currentColor" />
    <rect x="352" y="672" width="160" height="160" fill="currentColor" />
    <rect x="672" y="672" width="160" height="160" fill="currentColor" />
  </BaseIcon>
);
