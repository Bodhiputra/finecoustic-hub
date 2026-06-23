'use client';

import { useEffect, useRef, useState } from 'react';
import ChatMediaAttach from '@/components/appdev/ChatMediaAttach';
import MediaAttachments from '@/components/appdev/MediaAttachments';
import Icon from '@/components/Icon';
import { personKey } from '@/lib/appdev';
import { nameToInitials, avatarStyle } from '@/lib/appdev-avatars';

function formatWhen(iso, locale) {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function IssueChat({
  comments = [],
  displayName = '',
  onPost,
  posting,
  canPost = true,
  t,
  locale,
}) {
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [error, setError] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, comments]);

  const hasContent = body.trim() || imageUrls.length > 0 || videoUrls.length > 0;
  const mediaBusy = Boolean(uploadingMedia);
  const selfKey = personKey(displayName);

  const submit = async e => {
    e?.preventDefault();
    setError('');
    const trimmedBody = body.trim();
    if (!displayName.trim()) {
      setError(t('appdev.chat.nameRequired'));
      return;
    }
    if (!trimmedBody && !imageUrls.length && !videoUrls.length) {
      setError(t('appdev.media.contentRequired'));
      return;
    }

    try {
      await onPost({
        body: trimmedBody,
        image_urls: imageUrls,
        video_urls: videoUrls,
      });
      setBody('');
      setImageUrls([]);
      setVideoUrls([]);
      inputRef.current?.focus();
    } catch {
      setError(t('appdev.chat.postError'));
    }
  };

  const onInputKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!posting && hasContent) submit(e);
    }
  };

  const pendingMedia = imageUrls.length > 0 || videoUrls.length > 0;

  return (
    <section className="appdev-chat" aria-label={t('appdev.chat.title')}>
      <header className="appdev-chat-head">
        <h3>{t('appdev.chat.title')}</h3>
      </header>

      <div className="appdev-chat-thread" ref={threadRef}>
        {comments.length === 0 ? (
          <p className="appdev-chat-empty">{t('appdev.chat.empty')}</p>
        ) : (
          <ul className="appdev-chat-list">
            {comments.map(msg => {
              const isSelf = selfKey && personKey(msg.author) === selfKey;
              return (
                <li key={msg.id} className={`appdev-chat-item${isSelf ? ' is-self' : ''}`}>
                  {!isSelf && (
                    <span
                      className="appdev-chat-avatar"
                      style={avatarStyle(msg.author)}
                      aria-hidden="true"
                    >
                      {nameToInitials(msg.author)}
                    </span>
                  )}
                  <div className="appdev-chat-bubble">
                    {!isSelf && (
                      <span className="appdev-chat-author">
                        {msg.author || t('appdev.chat.anonymous')}
                      </span>
                    )}
                    {msg.body ? (
                      <div className="appdev-chat-text">{msg.body}</div>
                    ) : null}
                    <MediaAttachments
                      imageUrls={msg.image_urls || []}
                      videoUrls={msg.video_urls || []}
                      t={t}
                      compact
                    />
                    <time className="appdev-chat-time" dateTime={msg.created_at}>
                      {formatWhen(msg.created_at, locale)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canPost ? (
      <form className="appdev-chat-compose" onSubmit={submit}>
        {pendingMedia && (
          <div className="appdev-chat-pending">
            <MediaAttachments
              imageUrls={imageUrls}
              videoUrls={videoUrls}
              t={t}
              canRemove
              compact
              onRemoveImage={index => setImageUrls(imageUrls.filter((_, i) => i !== index))}
              onRemoveVideo={index => setVideoUrls(videoUrls.filter((_, i) => i !== index))}
              removeDisabled={posting || mediaBusy}
            />
          </div>
        )}

        {error && (
          <p className="appdev-chat-error" role="alert">
            {error}
          </p>
        )}

        {mediaBusy && (
          <p className="appdev-chat-uploading" role="status">
            {t('appdev.media.uploading')}
          </p>
        )}

        <div className="appdev-chat-compose-bar">
          <div className="appdev-chat-compose-tools">
            <ChatMediaAttach
              t={t}
              disabled={posting || mediaBusy}
              onUploadingChange={setUploadingMedia}
              onImage={url => {
                setError('');
                setImageUrls(prev => [...prev, url]);
              }}
              onVideo={url => {
                setError('');
                setVideoUrls(prev => [...prev, url]);
              }}
              onError={setError}
            />
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            className="appdev-chat-input"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('appdev.chat.inputPlaceholder')}
            disabled={posting || mediaBusy}
            aria-label={t('appdev.chat.message')}
          />
          <button
            type="submit"
            className="appdev-chat-send-btn"
            disabled={posting || mediaBusy || !hasContent}
            aria-label={posting ? t('appdev.chat.sending') : t('appdev.chat.send')}
            title={posting ? t('appdev.chat.sending') : t('appdev.chat.send')}
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </form>
      ) : (
        <p className="appdev-chat-readonly-notice" role="note">
          {t('appdev.chat.assigneeRequired')}
        </p>
      )}
    </section>
  );
}
