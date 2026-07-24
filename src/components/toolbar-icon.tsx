/**
 * 工具栏图标组件映射。
 */
import React from 'react';

import {
  IconArrow,
  IconBrush,
  IconClose,
  IconCopy,
  IconDownload,
  IconEllipse,
  IconHighlight,
  IconLine,
  IconMeasure,
  IconMosaic,
  IconMove,
  IconNumber,
  IconNext,
  IconPrev,
  IconRectangle,
  IconSubmit,
  IconText,
  IconTrash,
} from '../icons';

interface IconProps {
  /** 图标名 */
  name: string;
}

const ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  move: IconMove,
  close: IconClose,
  submit: IconSubmit,
  brush: IconBrush,
  mosaic: IconMosaic,
  number: IconNumber,
  line: IconLine,
  measure: IconMeasure,
  ellipse: IconEllipse,
  highlight: IconHighlight,
  rectangle: IconRectangle,
  arrow: IconArrow,
  text: IconText,
  copy: IconCopy,
  download: IconDownload,
  trash: IconTrash,
  prev: IconPrev,
  next: IconNext,
};

function ToolbarIcon({ name }: IconProps): React.ReactElement {
  const Comp = ICONS[name];
  if (!Comp) return <svg viewBox="0 0 24 24" aria-hidden="true" />;
  return <Comp className={name} />;
}

export default ToolbarIcon;
