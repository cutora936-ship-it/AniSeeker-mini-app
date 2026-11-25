import type { Portrait } from '../data/characters';

// Square sources use the longer side of the frame when object-fit crops them.
const portraitSizes = {
  feed: 'max(min(calc(100vw - 2rem), 31rem), calc(100dvh - 10rem))',
  dossier: 'max(min(calc(100vw - 2rem), 31rem), min(42dvh, 24rem))',
};

export function CharacterPortrait({ portrait, variant, className, alt = '', priority = false }: {
  portrait: Portrait;
  variant: keyof typeof portraitSizes | 'thumbnail';
  className: string;
  alt?: string;
  priority?: boolean;
}) {
  const thumbnail = variant === 'thumbnail';

  return (
    <img className={className} alt={alt}
      src={thumbnail ? portrait.thumbnail : portrait.medium}
      srcSet={thumbnail ? undefined : `${portrait.medium} 768w, ${portrait.large} 1254w`}
      sizes={thumbnail ? undefined : portraitSizes[variant]}
      loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined}
      decoding="async" />
  );
}
