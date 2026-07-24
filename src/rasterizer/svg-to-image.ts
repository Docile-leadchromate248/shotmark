/**
 * SVG → Image 转换
 *
 * 将 SVG 字符串加载为 Image 对象。
 * 优先使用 Blob URL（性能更好），fallback 到 data URI。
 *
 * 精简自 svg2image.js：移除了 PhantomJS 兼容检测，
 * 现代浏览器（Chrome/Firefox/Safari）均支持 Blob URL foreignObject 读取。
 */

/** 缓存 Blob URL 支持检测结果 */
let blobSupportResult: boolean | undefined;

/** 检测浏览器是否支持从 Blob URL 的 SVG foreignObject 回读 canvas */
async function checkBlobSupport(): Promise<boolean> {
  if (blobSupportResult !== undefined) return blobSupportResult;

  try {
    const testSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><foreignObject></foreignObject></svg>';
    const blobUrl = URL.createObjectURL(new Blob([testSvg], { type: 'image/svg+xml' }));

    const result = await new Promise<boolean>((resolve) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        try {
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          canvas.toDataURL('image/png');
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = blobUrl;
    });

    URL.revokeObjectURL(blobUrl);
    blobSupportResult = result;

    if (!result) {
      // fallback: 测试 data URI 是否可用
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(testSvg)}`;
      blobSupportResult = await new Promise<boolean>((resolve) => {
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.onload = () => {
          try {
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            canvas.toDataURL('image/png');
            resolve(false); // data URI 能用但 blob 不能，标记不使用 blob
          } catch {
            resolve(false);
          }
        };
        img.onerror = () => resolve(false);
        img.src = dataUrl;
      });
    }
  } catch {
    blobSupportResult = false;
  }

  return blobSupportResult;
}

/** 将 SVG 字符串转为可加载的 URL */
async function buildImageUrl(svg: string): Promise<{ url: string; isBlob: boolean }> {
  const useBlob = await checkBlobSupport();
  if (useBlob) {
    return {
      url: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
      isBlob: true,
    };
  }
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    isBlob: false,
  };
}

/**
 * 将 SVG 字符串渲染为 Image 对象
 *
 * @returns 加载完成的 HTMLImageElement
 * @throws 如果 SVG 渲染失败
 */
export async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const { url, isBlob } = await buildImageUrl(svg);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      if (isBlob) URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      if (isBlob) URL.revokeObjectURL(url);
      reject(new Error('[shotmark/rasterizer] SVG render failed'));
    };

    image.src = url;
  });
}
