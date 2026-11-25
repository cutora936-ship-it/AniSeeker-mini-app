import { useEffect, useState } from 'react';

export const avatarFileTypes = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export class AvatarError extends Error {}

async function imageType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (offset: number, signature: number[]) => signature.every((byte, i) => bytes[offset + i] === byte);

  if (matches(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(0, [137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80])) return 'image/webp';
  throw new AvatarError('Выбери изображение в формате JPG, PNG или WebP.');
}

export async function prepareAvatar(file: File): Promise<Blob> {
  const type = await imageType(file);
  const source = URL.createObjectURL(file.slice(0, file.size, type));

  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new AvatarError('Не удалось подготовить фото.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const mime = type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new AvatarError('Не удалось подготовить фото.'));
      }, mime, .86);
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function useAvatarUrl(image: Blob | null) {
  const [preview, setPreview] = useState<{ image: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview({ image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);

  return preview?.image === image ? preview.url : undefined;
}
