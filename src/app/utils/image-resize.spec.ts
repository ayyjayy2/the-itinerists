import { resizeToJpeg } from './image-resize';

/** A solid-colour PNG blob of the given size, made with a canvas. */
function makeImage(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6a8f5e'; ctx.fillRect(0, 0, width, height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

describe('resizeToJpeg', () => {
  it('scales a landscape image down so its long edge is maxPx, keeping the ratio', async () => {
    const out = await resizeToJpeg(await makeImage(2000, 1000), 500);
    expect(out.width).toBe(500);
    expect(out.height).toBe(250);
    expect(out.blob.type).toBe('image/jpeg');
  });

  it('scales a portrait image by its height', async () => {
    const out = await resizeToJpeg(await makeImage(600, 1200), 300);
    expect(out.width).toBe(150);
    expect(out.height).toBe(300);
  });

  it('never upscales a small image', async () => {
    const out = await resizeToJpeg(await makeImage(120, 80), 1600);
    expect(out.width).toBe(120);
    expect(out.height).toBe(80);
  });

  it('produces a smaller file at lower quality', async () => {
    const src = await makeImage(400, 400);
    const hi = await resizeToJpeg(src, 400, 0.95);
    const lo = await resizeToJpeg(src, 400, 0.3);
    expect(lo.blob.size).toBeLessThan(hi.blob.size);
  });

  it('rejects on something that is not an image', async () => {
    await expectAsync(resizeToJpeg(new Blob(['nope'], { type: 'text/plain' }), 100)).toBeRejected();
  });
});
