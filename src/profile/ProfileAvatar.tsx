import { Icon } from '../components/Icon';
import { useAvatarUrl } from './avatar';

export function ProfileAvatar({ image }: { image: Blob | null }) {
  const url = useAvatarUrl(image);

  return (
    <span className="profile-avatar glass" aria-hidden="true">
      {url ? <img src={url} alt="" /> : <Icon name="user" />}
    </span>
  );
}
