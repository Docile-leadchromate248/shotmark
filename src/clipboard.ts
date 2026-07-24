/**
 * 剪贴板与图片数据转换工具
 */

export type ImageMimeType = 'image/png' | 'image/jpeg';

export const dataUrlToBlob = async (
  dataUrl: string,
  targetType: ImageMimeType = 'image/png',
): Promise<Blob> => {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to decode image data'));
  });
  img.src = dataUrl;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  if (targetType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), targetType, 0.92);
  });
  if (!blob) throw new Error(`Failed to encode image as ${targetType}`);
  return blob;
};

export const copyBlobToClipboard = async (blob: Blob): Promise<void> => {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard API unavailable in current browser context');
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
};
