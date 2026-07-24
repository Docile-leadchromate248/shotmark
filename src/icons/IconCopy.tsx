import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconCopy = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M672 128H192c-35.2 0-64 28.8-64 64v512h64V192h480v-64zM832 320H320c-35.2 0-64 28.8-64 64v448c0 35.2 28.8 64 64 64h512c35.2 0 64-28.8 64-64V384c0-35.2-28.8-64-64-64zm0 512H320V384h512v448z" />
  </BaseIcon>
);
