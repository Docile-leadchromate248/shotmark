import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconLine = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M848 432a80.064 80.064 0 0 0-73.216 48H217.216A80.096 80.096 0 0 0 144 432 80.096 80.096 0 0 0 64 512c0 44.128 35.904 80 80 80A80 80 0 0 0 217.216 544h557.536a80 80 0 0 0 73.216 48c44.128 0 80-35.872 80-80a80.032 80.032 0 0 0-79.968-80z" />
  </BaseIcon>
);
