'use client';

import { getVideoEmbed } from '@/lib/appdev-media';

function VideoPreview({ url, t, canRemove, onRemove, removeDisabled }) {
  const embed = getVideoEmbed(url);

  return (
    <figure className="appdev-media-figure appdev-media-figure-video">
      <div className="appdev-media-video">
        {embed?.kind === 'iframe' ? (
          <iframe
            src={embed.src}
            title={t('appdev.media.videoEmbed')}
            className="appdev-media-video-frame"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : embed?.kind === 'video' ? (
          <video
            src={embed.src}
            controls
            playsInline
            preload="metadata"
            className="appdev-media-video-native"
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="appdev-media-video-open"
          >
            {t('appdev.media.openVideoLink')}
          </a>
        )}
      </div>
      {canRemove && onRemove && (
        <button
          type="button"
          className="appdev-media-preview-remove"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={t('appdev.media.removeFile')}
        >
          ×
        </button>
      )}
    </figure>
  );
}

export default function MediaAttachments({
  imageUrls = [],
  videoUrls = [],
  t,
  canRemove = false,
  onRemoveImage,
  onRemoveVideo,
  removeDisabled = false,
  compact = false,
}) {
  if (!imageUrls.length && !videoUrls.length) return null;

  return (
    <div className={`appdev-media-preview${compact ? ' appdev-media-preview--compact' : ''}`}>
      {imageUrls.length > 0 && (
        <div className="appdev-media-images">
          {imageUrls.map((url, index) => (
            <figure key={`${url}-${index}`} className="appdev-media-figure">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="appdev-media-image-link"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="appdev-media-image" loading="lazy" />
              </a>
              {canRemove && onRemoveImage && (
                <button
                  type="button"
                  className="appdev-media-preview-remove"
                  onClick={() => onRemoveImage(index)}
                  disabled={removeDisabled}
                  aria-label={t('appdev.media.removeFile')}
                >
                  ×
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {videoUrls.length > 0 && (
        <div className="appdev-media-videos">
          {videoUrls.map((url, index) => (
            <VideoPreview
              key={`${url}-${index}`}
              url={url}
              t={t}
              canRemove={canRemove}
              onRemove={onRemoveVideo ? () => onRemoveVideo(index) : undefined}
              removeDisabled={removeDisabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
