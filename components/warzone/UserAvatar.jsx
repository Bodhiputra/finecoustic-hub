'use client';

import { nameToInitials, avatarStyle } from '@/lib/appdev-avatars';

export default function UserAvatar({ name, size = 28, className = '' }) {
  const style = {
    ...avatarStyle(name),
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
  };
  return (
    <span className={`warzone-avatar ${className}`.trim()} style={style} aria-hidden="true">
      {nameToInitials(name)}
    </span>
  );
}
