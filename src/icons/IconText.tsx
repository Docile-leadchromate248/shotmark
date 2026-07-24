import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconText = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M779.776 192H224a32 32 0 0 0 0 64h245.888v597.888a32 32 0 0 0 64 0V256h245.888a32 32 0 0 0 0-64" />
  </BaseIcon>
);
