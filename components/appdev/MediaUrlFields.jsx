'use client';

import { useCallback, useRef, useState } from 'react';
import MediaAttachments from '@/components/appdev/MediaAttachments';
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  isImageFile,
  isVideoFile,
  translateMediaValidation,
  validateImageFileDeep,
  validateVideoFileDeep,
  VIDEO_ACCEPT,
  VIDEO_MAX_BYTES,
  formatMaxLabel,
  tMedia,
} from '@/lib/appdev-media';
import { uploadAppdevMediaFile } from '@/lib/appdev-upload-client';

async function uploadFile(file, kind) {
  return uploadAppdevMediaFile(file, kind);
}

function MediaDropzone({
  kind,
  accept,
  promptKey,
  addMoreKey,
  limitKey,
  maxBytes,
  disabled,
  uploading,
  canManageMedia,
  hasFile,
  errors,
  onFiles,
  children,
  t,
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const zoneDisabled = disabled || uploading || !canManageMedia;

  const openPicker = () => {
    if (zoneDisabled) return;
    fileInputRef.current?.click();
  };

  const onDragEnter = e => {
    e.preventDefault();
    e.stopPropagation();
    if (zoneDisabled) return;
    dragCounter.current += 1;
    setDragging(true);
  };

  const onDragLeave = e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  };

  const onDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    if (zoneDisabled) return;
    onFiles(e.dataTransfer?.files);
  };

  return (
    <div className="appdev-media-section">
      <div className="appdev-media-section-head">
        <span className="appdev-media-section-label">
          {t(`appdev.media.${kind === 'image' ? 'imageLabel' : 'videoLabel'}`)}
        </span>
        <span className="appdev-media-limit-pill">
          {tMedia(t, limitKey, { max: formatMaxLabel(maxBytes) })}
        </span>
      </div>

      <div
        className={[
          'appdev-media-dropzone',
          dragging ? 'is-dragover' : '',
          zoneDisabled ? 'is-disabled' : '',
          hasFile ? 'has-files' : '',
          errors.length ? 'has-error' : '',
        ].filter(Boolean).join(' ')}
        onClick={openPicker}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        role="button"
        tabIndex={zoneDisabled ? -1 : 0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        aria-disabled={zoneDisabled}
        aria-label={t(promptKey)}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="appdev-media-file-input"
          disabled={zoneDisabled}
          onChange={e => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
          onClick={e => e.stopPropagation()}
        />

        {!hasFile && (
          <div className="appdev-media-dropzone-body">
            <span className="appdev-media-dropzone-icon" aria-hidden="true">
              {kind === 'image' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path d="M21 16l-5.5-5.5L5 19" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M10 9.5l5 3.5-5 3.5V9.5z" fill="currentColor" stroke="none" />
                </svg>
              )}
            </span>
            {uploading ? (
              <p className="appdev-media-dropzone-text">{t('appdev.media.uploading')}</p>
            ) : (
              <>
                <p className="appdev-media-dropzone-text">{t(promptKey)}</p>
                <span className="appdev-media-dropzone-browse">{t('appdev.media.browse')}</span>
              </>
            )}
          </div>
        )}

        {hasFile && !uploading && (
          <p className="appdev-media-dropzone-replace">{t(addMoreKey)}</p>
        )}

        {children}
      </div>

      {errors.length > 0 && (
        <ul className="appdev-media-errors" role="alert">
          {errors.map(msg => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MediaUrlFields({
  imageUrls = [],
  videoUrls = [],
  onChangeImages,
  onChangeVideos,
  t,
  disabled = false,
  canManageMedia = true,
}) {
  const [uploadingKind, setUploadingKind] = useState(null);
  const [imageErrors, setImageErrors] = useState([]);
  const [videoErrors, setVideoErrors] = useState([]);

  const processImageFiles = useCallback(
    async files => {
      if (disabled || !canManageMedia || !files?.length) return;

      const imageFiles = Array.from(files).filter(isImageFile);
      if (!imageFiles.length) {
        setImageErrors([t('appdev.media.imageTypeError')]);
        return;
      }

      const errors = [];
      const validFiles = [];
      for (const file of imageFiles) {
        const check = await validateImageFileDeep(file);
        if (!check.ok) {
          errors.push(translateMediaValidation(check, t));
        } else {
          validFiles.push(file);
        }
      }

      if (!validFiles.length) {
        setImageErrors(errors);
        return;
      }

      setUploadingKind('image');
      setImageErrors(errors);
      const uploaded = [];
      try {
        for (const file of validFiles) {
          const url = await uploadFile(file, 'image');
          uploaded.push(url);
        }
        onChangeImages([...imageUrls, ...uploaded]);
      } catch (err) {
        setImageErrors(prev => [...prev, err.message || t('appdev.media.uploadFailed')]);
        if (uploaded.length) onChangeImages([...imageUrls, ...uploaded]);
      } finally {
        setUploadingKind(null);
      }
    },
    [disabled, canManageMedia, onChangeImages, imageUrls, t]
  );

  const processVideoFiles = useCallback(
    async files => {
      if (disabled || !canManageMedia || !files?.length) return;

      const videoFiles = Array.from(files).filter(isVideoFile);
      if (!videoFiles.length) {
        setVideoErrors([t('appdev.media.videoTypeError')]);
        return;
      }

      const errors = [];
      const validFiles = [];
      for (const file of videoFiles) {
        const check = await validateVideoFileDeep(file);
        if (!check.ok) {
          errors.push(translateMediaValidation(check, t));
        } else {
          validFiles.push(file);
        }
      }

      if (!validFiles.length) {
        setVideoErrors(errors);
        return;
      }

      setUploadingKind('video');
      setVideoErrors(errors);
      const uploaded = [];
      try {
        for (const file of validFiles) {
          const url = await uploadFile(file, 'video');
          uploaded.push(url);
        }
        onChangeVideos([...videoUrls, ...uploaded]);
      } catch (err) {
        setVideoErrors(prev => [...prev, err.message || t('appdev.media.uploadFailed')]);
        if (uploaded.length) onChangeVideos([...videoUrls, ...uploaded]);
      } finally {
        setUploadingKind(null);
      }
    },
    [disabled, canManageMedia, onChangeVideos, videoUrls, t]
  );

  const onPaste = e => {
    if (disabled || uploadingKind || !canManageMedia) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const pasted = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pasted.push(file);
      }
    }
    if (!pasted.length) return;

    e.preventDefault();
    const imageFiles = pasted.filter(isImageFile);
    const videoFiles = pasted.filter(isVideoFile);
    if (imageFiles.length) processImageFiles(imageFiles);
    if (videoFiles.length) processVideoFiles(videoFiles);
  };

  const hasAttachments = imageUrls.length > 0 || videoUrls.length > 0;
  const uploading = Boolean(uploadingKind);

  return (
    <div className="appdev-media-fields" onPaste={canManageMedia ? onPaste : undefined}>
      <span className="appdev-media-label">{t('appdev.media.label')}</span>

      {canManageMedia && (
        <>
          <MediaDropzone
            kind="image"
            accept={IMAGE_ACCEPT}
            promptKey="appdev.media.imageDropPrompt"
            addMoreKey="appdev.media.addMoreHint"
            limitKey="appdev.media.imageLimit"
            maxBytes={IMAGE_MAX_BYTES}
            disabled={disabled}
            uploading={uploadingKind === 'image'}
            canManageMedia={canManageMedia}
            hasFile={imageUrls.length > 0}
            errors={imageErrors}
            onFiles={processImageFiles}
            t={t}
          />

          <MediaDropzone
            kind="video"
            accept={VIDEO_ACCEPT}
            promptKey="appdev.media.videoDropPrompt"
            addMoreKey="appdev.media.addMoreHint"
            limitKey="appdev.media.videoLimit"
            maxBytes={VIDEO_MAX_BYTES}
            disabled={disabled}
            uploading={uploadingKind === 'video'}
            canManageMedia={canManageMedia}
            hasFile={videoUrls.length > 0}
            errors={videoErrors}
            onFiles={processVideoFiles}
            t={t}
          />

          <p className="appdev-media-dropzone-hint">{t('appdev.media.dropHint')}</p>
        </>
      )}

      {hasAttachments && (
        <MediaAttachments
          imageUrls={imageUrls}
          videoUrls={videoUrls}
          t={t}
          canRemove={canManageMedia}
          onRemoveImage={index => onChangeImages(imageUrls.filter((_, i) => i !== index))}
          onRemoveVideo={index => onChangeVideos(videoUrls.filter((_, i) => i !== index))}
          removeDisabled={disabled || uploading}
        />
      )}
    </div>
  );
}
