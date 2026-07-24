import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconDownload = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M544 128h-64v451.2l-137.4-137.4-45.2 45.2L512 701.8 726.6 487l-45.2-45.2L544 579.2V128zM192 800h640v64H192z" />
  </BaseIcon>
);
