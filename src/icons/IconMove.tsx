import type { ReactElement } from 'react';
import { BaseIcon, FillPath, type SvgIconProps } from './base';

export const IconMove = (props: SvgIconProps): ReactElement => (
  <BaseIcon {...props}>
    <FillPath d="M576 640 576 832 704 832 512 1024 320 832 448 832 448 640ZM448 384 448 192 320 192 512 0 704 192 576 192 576 384ZM384 576 192 576 192 704 0 512 192 320 192 448 384 448ZM640 448 832 448 832 320 1024 512 832 704 832 576 640 576Z" />
  </BaseIcon>
);
