import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconNext = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M608 608c-148.8 0-266.4 19.2-355.2 50.4C166.4 692 92 761.6 32 872c2.4-14.4 7.2-33.6 14.4-57.6s24-64.8 52.8-127.2c28.8-60 62.4-112.8 103.2-160.8C240.8 480.8 296 440 368 401.6c72-38.4 196.8-81.6 240-81.6V128l384 348-384 348V608z" />
  </BaseIcon>
);
