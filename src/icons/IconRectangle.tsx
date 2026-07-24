import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconRectangle = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M898.8 199.6v624.8H125.2V199.6h773.6m59.5-59.5H65.7v743.8h892.5V140.1h0.1z" />
  </BaseIcon>
);
