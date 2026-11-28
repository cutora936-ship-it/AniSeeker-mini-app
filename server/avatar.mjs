import sharp from 'sharp';

const maxBytes = 1024 * 1024;

export async function normalizeImage(data) {
  if (typeof data !== 'string' || data.length > 4 * Math.ceil(maxBytes / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > maxBytes) return null;
  try {
    const image = sharp(bytes, { limitInputPixels: 1024 * 1024, failOn: 'error' });
    const info = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages ?? 1) !== 1
      || !info.width || !info.height || info.width > 1024 || info.height > 1024) return null;
    return await image.autoOrient().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
}
