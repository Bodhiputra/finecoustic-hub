'use client';

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import MediaAttachments from '@/components/appdev/MediaAttachments';
import Icon from '@/components/Icon';
import {
  FILE_ACCEPT,
  FILE_MAX_COUNT,
  isAllowedAttachmentFile,
  normalizeFileUrls,
  translateFileValidation,
  validateAttachmentFileDeep,
  fileIconLabel,
} from '@/lib/appdev-files';
import {
  IMAGE_ACCEPT,
  isImageFile,
  isVideoFile,
  translateMediaValidation,
  validateImageFileDeep,
  validateVideoFileDeep,
  VIDEO_ACCEPT,
  formatBytes,
} from '@/lib/appdev-media';
import { uploadInternalAttachmentFile, uploadInternalMediaFile } from '@/lib/hub-upload-client';

function FileList({ files, canRemove, onRemove, removeDisabled, t }) {
  if (!files.length) return null;

  return (
    <ul className="appdev-file-list">
      {files.map((file, index) => (
        <li key={`${file.url}-${index}`} className="appdev-file-item">
          <span className="appdev-file-kind" aria-hidden="true">
            {fileIconLabel(file.name)}
          </span>
          <div className="appdev-file-meta">
            <a
              href={file.url}
              download={file.name}
              target="_blank"
              rel="noopener noreferrer"
              className="appdev-file-name"
            >
              {file.name}
            </a>
            {file.size > 0 && (
              <span className="appdev-file-size">{formatBytes(file.size)}</span>
            )}
          </div>
          {canRemove && (
            <button
              type="button"
              className="appdev-file-remove"
              onClick={() => onRemove(index)}
              disabled={removeDisabled}
              aria-label={t('appdev.files.removeFile')}
              title={t('appdev.files.removeFile')}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const TaskAttachmentFields = forwardRef(function TaskAttachmentFields(
  {
    imageUrls = [],
    videoUrls = [],
    fileUrls = [],
    onChangeImages,
    onChangeVideos,
    onChangeFiles,
    t,
    disabled = false,
    canManage = true,
  },
  ref
) {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const files = normalizeFileUrls(fileUrls);

  const zoneDisabled = disabled || uploading || !canManage;

  const uploadImages = useCallback(
    async imageFiles => {
      const errors = [];
      const validFiles = [];
      for (const file of imageFiles) {
        const check = await validateImageFileDeep(file);
        if (!check.ok) errors.push(translateMediaValidation(check, t));
        else validFiles.push(file);
      }
      if (!validFiles.length) return { uploaded: [], errors };

      const uploaded = [];
      for (const file of validFiles) {
        const url = await uploadInternalMediaFile(file, 'image');
        uploaded.push(url);
      }
      if (uploaded.length) onChangeImages([...imageUrls, ...uploaded]);
      return { uploaded, errors };
    },
    [imageUrls, onChangeImages, t]
  );

  const uploadVideos = useCallback(
    async videoFiles => {
      const errors = [];
      const validFiles = [];
      for (const file of videoFiles) {
        const check = await validateVideoFileDeep(file);
        if (!check.ok) errors.push(translateMediaValidation(check, t));
        else validFiles.push(file);
      }
      if (!validFiles.length) return { uploaded: [], errors };

      const uploaded = [];
      for (const file of validFiles) {
        const url = await uploadInternalMediaFile(file, 'video');
        uploaded.push(url);
      }
      if (uploaded.length) onChangeVideos([...videoUrls, ...uploaded]);
      return { uploaded, errors };
    },
    [onChangeVideos, t, videoUrls]
  );

  const uploadAttachments = useCallback(
    async attachmentFiles => {
      const remaining = FILE_MAX_COUNT - files.length;
      if (remaining <= 0) {
        return {
          uploaded: [],
          errors: [translateFileValidation({ ok: false, error: 'fileLimit' }, t)],
        };
      }

      const batch = attachmentFiles.slice(0, remaining);
      const errors = [];
      const validFiles = [];
      for (const file of batch) {
        const check = await validateAttachmentFileDeep(file);
        if (!check.ok) errors.push(translateFileValidation(check, t));
        else validFiles.push(file);
      }
      if (!validFiles.length) return { uploaded: [], errors };

      const uploaded = [];
      for (const file of validFiles) {
        uploaded.push(await uploadInternalAttachmentFile(file));
      }
      if (uploaded.length) onChangeFiles([...files, ...uploaded]);
      return { uploaded, errors };
    },
    [files, onChangeFiles, t]
  );

  const processIncomingFiles = useCallback(
    async rawFiles => {
      if (zoneDisabled || !rawFiles?.length) return;

      const list = Array.from(rawFiles);
      const imageFiles = list.filter(isImageFile);
      const videoFiles = list.filter(isVideoFile);
      const attachmentFiles = list.filter(
        file => !isImageFile(file) && !isVideoFile(file) && isAllowedAttachmentFile(file)
      );
      const unsupported = list.filter(
        file => !isImageFile(file) && !isVideoFile(file) && !isAllowedAttachmentFile(file)
      );

      if (!imageFiles.length && !videoFiles.length && !attachmentFiles.length) {
        setErrors([unsupported.length ? t('hub.internal.taskPanel.attachmentUnsupported') : t('appdev.files.typeError')]);
        return;
      }

      setUploading(true);
      const collectedErrors = [];

      try {
        if (imageFiles.length) {
          const result = await uploadImages(imageFiles);
          collectedErrors.push(...result.errors);
        }
        if (videoFiles.length) {
          const result = await uploadVideos(videoFiles);
          collectedErrors.push(...result.errors);
        }
        if (attachmentFiles.length) {
          const result = await uploadAttachments(attachmentFiles);
          collectedErrors.push(...result.errors);
        }
        if (unsupported.length) {
          collectedErrors.push(t('hub.internal.taskPanel.attachmentUnsupported'));
        }
        setErrors(collectedErrors.filter(Boolean));
      } catch (err) {
        setErrors(prev => [...prev, err.message || t('appdev.media.uploadFailed')]);
      } finally {
        setUploading(false);
      }
    },
    [zoneDisabled, t, uploadAttachments, uploadImages, uploadVideos]
  );

  useImperativeHandle(ref, () => ({
    processFiles: processIncomingFiles,
  }), [processIncomingFiles]);

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
    processIncomingFiles(e.dataTransfer?.files);
  };

  const onPaste = e => {
    if (zoneDisabled) return;
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
    processIncomingFiles(pasted);
  };

  const hasAttachments = imageUrls.length > 0 || videoUrls.length > 0 || files.length > 0;
  const accept = `${IMAGE_ACCEPT},${VIDEO_ACCEPT},${FILE_ACCEPT}`;

  if (!canManage && !hasAttachments) return null;

  return (
    <div className="appdev-media-fields task-attachment-fields" onPaste={canManage ? onPaste : undefined}>
      <span className="appdev-media-label">{t('appdev.media.label')}</span>

      {canManage && (
        <>
          <div
            className={[
              'appdev-media-dropzone task-attachment-dropzone',
              dragging ? 'is-dragover' : '',
              zoneDisabled ? 'is-disabled' : '',
              hasAttachments ? 'has-files' : '',
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
            aria-label={t('hub.internal.taskPanel.attachmentDropPrompt')}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple
              className="appdev-media-file-input"
              disabled={zoneDisabled}
              onChange={e => {
                processIncomingFiles(e.target.files);
                e.target.value = '';
              }}
              onClick={e => e.stopPropagation()}
            />

            <div className="appdev-media-dropzone-body">
              <span className="appdev-media-dropzone-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v12" strokeLinecap="round" />
                  <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" strokeLinecap="round" />
                </svg>
              </span>
              {uploading ? (
                <p className="appdev-media-dropzone-text">{t('hub.internal.taskPanel.attachmentUploading')}</p>
              ) : (
                <>
                  <p className="appdev-media-dropzone-text">{t('hub.internal.taskPanel.attachmentDropPrompt')}</p>
                  <span className="appdev-media-dropzone-browse">{t('appdev.media.browse')}</span>
                </>
              )}
            </div>
          </div>

          <p className="appdev-media-dropzone-hint">{t('hub.internal.taskPanel.attachmentDropHint')}</p>
        </>
      )}

      {errors.length > 0 && (
        <ul className="appdev-media-errors" role="alert">
          {errors.map(msg => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      {hasAttachments && (
        <MediaAttachments
          imageUrls={imageUrls}
          videoUrls={videoUrls}
          t={t}
          canRemove={canManage}
          onRemoveImage={index => onChangeImages(imageUrls.filter((_, i) => i !== index))}
          onRemoveVideo={index => onChangeVideos(videoUrls.filter((_, i) => i !== index))}
          removeDisabled={disabled || uploading}
        />
      )}

      <FileList
        files={files}
        canRemove={canManage}
        onRemove={index => onChangeFiles(files.filter((_, i) => i !== index))}
        removeDisabled={disabled || uploading}
        t={t}
      />
    </div>
  );
});

export default TaskAttachmentFields;
