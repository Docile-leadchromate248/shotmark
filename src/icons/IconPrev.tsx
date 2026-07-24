import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconPrev = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M407 325.667v-199.5l-349.5 349.5 349.5 349.5v-204c250.5 0 424.5 79.5 550.5 255-51-250.5-201-501-550.5-550.5" />
  </BaseIcon>
);
