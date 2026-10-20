import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyRich, copyPlain } from './clipboard';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('copyRich', () => {
  it('writes html and plain blobs via ClipboardItem', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const capturedItems: ClipboardItem[] = [];
    vi.stubGlobal('ClipboardItem', class MockClipboardItem {
      data: Record<string, Blob>;
      constructor(data: Record<string, Blob>) { this.data = data; capturedItems.push(this as unknown as ClipboardItem); }
    });
    Object.assign(navigator, { clipboard: { write, writeText: vi.fn() } });

    await copyRich('<b>hi</b>', 'hi');

    expect(write).toHaveBeenCalledOnce();
    const item = capturedItems[0] as unknown as { data: Record<string, Blob> };
    expect(Object.keys(item.data)).toEqual(expect.arrayContaining(['text/html', 'text/plain']));
  });

  it('falls back to writeText when ClipboardItem is undefined', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyRich('<b>hi</b>', 'hi');

    expect(writeText).toHaveBeenCalledWith('hi');
  });
});

describe('copyPlain', () => {
  it('calls writeText with the given string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await copyPlain('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
  });
});
