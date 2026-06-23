'use client';

import { nameToInitials, avatarStyle } from '@/lib/appdev-avatars';
import { personKey } from '@/lib/appdev';

const MAX_VISIBLE = 5;

function AvatarCircle({ name, isSelf = false, zIndex = 1, label }) {
  const tip = label || name;
  return (
    <span className="appdev-avatar-wrap" style={{ zIndex }}>
      <span
        className={`appdev-avatar${isSelf ? ' is-self' : ''}`}
        style={avatarStyle(name)}
        aria-label={tip}
        tabIndex={0}
      >
        {nameToInitials(name)}
      </span>
      <span className="appdev-avatar-tip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

export default function PresenceAvatars({
  online = [],
  currentUser = '',
  t,
  maxVisible = MAX_VISIBLE,
}) {
  const selfKey = personKey(currentUser);
  const names = [];
  const seen = new Set();

  if (currentUser && selfKey) {
    names.push(currentUser);
    seen.add(selfKey);
  }

  for (const entry of online) {
    const name = entry.displayName || entry.display_name || '';
    const key = personKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  if (!names.length) return null;

  const visible = names.slice(0, maxVisible);
  const overflow = names.length - visible.length;

  return (
    <div className="appdev-presence" aria-label={names.join(', ')}>
      <div className="appdev-presence-stack" role="list">
        {visible.map((name, i) => (
          <AvatarCircle
            key={personKey(name)}
            name={name}
            isSelf={personKey(name) === selfKey}
            zIndex={visible.length - i}
            label={personKey(name) === selfKey ? `${name} (${t('appdev.board.you')})` : name}
          />
        ))}
        {overflow > 0 && (
          <span className="appdev-avatar-wrap appdev-avatar-wrap-overflow" style={{ zIndex: 0 }}>
            <span className="appdev-avatar appdev-avatar-overflow" aria-label={names.slice(maxVisible).join(', ')} tabIndex={0}>
              +{overflow}
            </span>
            <span className="appdev-avatar-tip" role="tooltip">
              {names.slice(maxVisible).join(', ')}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
