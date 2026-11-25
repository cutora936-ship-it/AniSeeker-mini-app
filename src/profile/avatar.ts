import { useEffect, useState } from 'react';

export const avatarFileTypes = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export class AvatarError extends Error {}

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
