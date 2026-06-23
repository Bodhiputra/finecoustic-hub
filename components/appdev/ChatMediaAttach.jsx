'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { uploadAppdevMediaFile } from '@/lib/appdev-upload-client';
import {
  IMAGE_ACCEPT,
  isImageFile,
  isVideoFile,
  translateMediaValidation,
  validateImageFileDeep,
  validateVideoFileDeep,
  VIDEO_ACCEPT,
} from '@/lib/appdev-media';

export default function ChatMediaAttach({
  onImage,
  onVideo,
  t,
  disabled = false,
  onError,
  onUploadingChange,
}) {
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const reportError = useCallback(
    msg => {
      onError?.(msg);
    },
    [onError]
  );

  const processImage = useCallback(
    async files => {
      if (disabled || uploading || !files?.length) return;

      const file = Array.from(files).find(isImageFile);
      if (!file) {
        reportError(t('appdev.media.imageTypeError'));
        return;
      }

      const check = await validateImageFileDeep(file);
      if (!check.ok) {
        reportError(translateMediaValidation(check, t));
        return;
      }

      setUploading('image');
      try {
        const url = await uploadAppdevMediaFile(file, 'image');
        onImage(url);
      } catch (err) {
        reportError(err.message || t('appdev.media.uploadFailed'));
      } finally {
        setUploading(null);
      }
    },
    [disabled, uploading, onImage, reportError, t]
  );

  const processVideo = useCallback(
    async files => {
      if (disabled || uploading || !files?.length) return;

      const file = Array.from(files).find(isVideoFile);
      if (!file) {
        reportError(t('appdev.media.videoTypeError'));
        return;
      }

      const check = await validateVideoFileDeep(file);
      if (!check.ok) {
        reportError(translateMediaValidation(check, t));
        return;
      }

      setUploading('video');
      try {
        const url = await uploadAppdevMediaFile(file, 'video');
        onVideo(url);
      } catch (err) {
        reportError(err.message || t('appdev.media.uploadFailed'));
      } finally {
        setUploading(null);
      }
    },
    [disabled, uploading, onVideo, reportError, t]
  );

  const busy = disabled || Boolean(uploading);

  return (
    <>
      <button
        type="button"
        className={[
          'appdev-chat-icon-btn',
          uploading === 'image' ? 'is-uploading' : '',
        ].filter(Boolean).join(' ')}
        disabled={busy}
        aria-label={t('appdev.media.imageLabel')}
        title={uploading === 'image' ? t('appdev.media.uploading') : t('appdev.media.imageLabel')}
        onClick={() => imageRef.current?.click()}
      >
        <Icon name="image" size={18} />
      </button>
      <button
        type="button"
        className={[
          'appdev-chat-icon-btn',
          uploading === 'video' ? 'is-uploading' : '',
        ].filter(Boolean).join(' ')}
        disabled={busy}
        aria-label={t('appdev.media.videoLabel')}
        title={uploading === 'video' ? t('appdev.media.uploading') : t('appdev.media.videoLabel')}
        onClick={() => videoRef.current?.click()}
      >
        <Icon name="video" size={18} />
      </button>
      <input
        ref={imageRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="appdev-chat-file-input"
        tabIndex={-1}
        aria-hidden
        onChange={e => {
          processImage(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="appdev-chat-file-input"
        tabIndex={-1}
        aria-hidden
        onChange={e => {
          processVideo(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
