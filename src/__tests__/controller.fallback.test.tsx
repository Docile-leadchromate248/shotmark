import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dataUrlToBlob: vi.fn(),
  copyBlobToClipboard: vi.fn(),
  showMessage: vi.fn(),
  unmount: vi.fn(),
}));

let stageProps: any;

vi.mock('../clipboard', () => ({
  dataUrlToBlob: mocks.dataUrlToBlob,
  copyBlobToClipboard: mocks.copyBlobToClipboard,
}));

vi.mock('../message', () => ({
  showMessage: mocks.showMessage,
}));

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: (node: any) => {
      stageProps = node.props;
    },
    unmount: mocks.unmount,
  }),
}));

import ShotmarkController from '../controller';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('controller submit fallback', () => {
  beforeEach(() => {
    stageProps = undefined;
    mocks.dataUrlToBlob.mockReset();
    mocks.copyBlobToClipboard.mockReset();
    mocks.showMessage.mockReset();
    mocks.unmount.mockReset();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    ShotmarkController.close();
    vi.restoreAllMocks();
  });

  it('calls onShot when provided and does not run copy fallback', async () => {
    const onShot = vi.fn();

    ShotmarkController.start({ onShot });

    await stageProps.submit({
      getImage: async () => ({
        image: 'data:image/png;base64,abc',
        width: 10,
        height: 10,
        pixWidth: 20,
        pixHeight: 20,
      }),
    });

    await flush();

    expect(onShot).toHaveBeenCalledTimes(1);
    expect(mocks.dataUrlToBlob).not.toHaveBeenCalled();
    expect(mocks.copyBlobToClipboard).not.toHaveBeenCalled();
  });

  it('uses copy fallback when onShot is missing', async () => {
    const blob = new Blob(['ok'], { type: 'image/png' });
    const onCopy = vi.fn();

    mocks.dataUrlToBlob.mockResolvedValue(blob);
    mocks.copyBlobToClipboard.mockResolvedValue(undefined);

    ShotmarkController.start({ onCopy });

    await stageProps.submit({
      getImage: async () => ({
        image: 'data:image/png;base64,abc',
        width: 10,
        height: 10,
        pixWidth: 20,
        pixHeight: 20,
      }),
    });

    await flush();

    expect(mocks.dataUrlToBlob).toHaveBeenCalledWith('data:image/png;base64,abc', 'image/png');
    expect(mocks.copyBlobToClipboard).toHaveBeenCalledWith(blob);
    expect(onCopy).toHaveBeenCalledWith(blob);
    expect(mocks.showMessage).toHaveBeenCalledWith({ type: 'success', content: '已复制到剪贴板' });
  });

  it('shows error message when copy fallback fails', async () => {
    const onCopyError = vi.fn();

    mocks.dataUrlToBlob.mockRejectedValue(new Error('mock copy failure'));

    ShotmarkController.start({ onCopyError });

    await stageProps.submit({
      getImage: async () => ({
        image: 'data:image/png;base64,abc',
        width: 10,
        height: 10,
        pixWidth: 20,
        pixHeight: 20,
      }),
    });

    await flush();

    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect(mocks.showMessage).toHaveBeenCalledWith({
      type: 'error',
      content: '复制失败，请检查剪贴板权限',
    });
  });

  it('supports locale preset for message text', async () => {
    const blob = new Blob(['ok'], { type: 'image/png' });

    mocks.dataUrlToBlob.mockResolvedValue(blob);
    mocks.copyBlobToClipboard.mockResolvedValue(undefined);

    ShotmarkController.start({ locale: 'en-US' });

    await stageProps.submit({
      getImage: async () => ({
        image: 'data:image/png;base64,abc',
        width: 10,
        height: 10,
        pixWidth: 20,
        pixHeight: 20,
      }),
    });

    await flush();

    expect(mocks.showMessage).toHaveBeenCalledWith({
      type: 'success',
      content: 'Copied to clipboard',
    });
  });
});
