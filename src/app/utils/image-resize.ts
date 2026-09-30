/**
 * Browser-side image downscaling. Decodes an image blob, fits it inside a
 * maxPx square (never upscaling), and re-encodes as JPEG. Used for outfit
 * photos so the phone does the heavy lifting and Cloud Storage only ever
 * receives the two sizes we serve.
 */
export interface ResizedImage { blob: Blob; width: number; height: number }

export function resizeToJpeg(source: Blob, maxPx: number, quality = 0.85): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    const done = () => URL.revokeObjectURL(url);
    img.onload = () => {
      done();
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                 { width  = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve({ blob, width, height }) : reject(new Error('Image encoding failed')),
        'image/jpeg', quality,
      );
    };
    img.onerror = () => { done(); reject(new Error('That file is not an image the browser can read')); };
    img.src = url;
  });
}
