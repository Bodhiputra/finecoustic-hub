'use client';

import { useCallback, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import {
  FILE_ACCEPT,
  FILE_MAX_BYTES,
  FILE_MAX_COUNT,
  isAllowedAttachmentFile,
  normalizeFileUrls,
  translateFileValidation,
  validateAttachmentFileDeep,
  fileIconLabel,
} from '@/lib/appdev-files';
import { formatBytes, formatMaxLabel } from '@/lib/appdev-media';
import { uploadAppdevAttachmentFile } from '@/lib/hub-upload-client';

function FileDropzone({
  disabled,
  uploading,
  canManageFiles,
  hasFiles,
  errors,
  onFiles,
  t,
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const zoneDisabled = disabled || uploading || !canManageFiles;

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
    <div className="appdev-file-section">
      <div className="appdev-file-section-head">
        <span className="appdev-file-section-label">{t('appdev.files.label')}</span>
        <span className="appdev-media-limit-pill">
          {t('appdev.files.limit').replace('{max}', formatMaxLabel(FILE_MAX_BYTES))}
        </span>
      </div>

      {canManageFiles && (
        <div
          className={[
            'appdev-media-dropzone appdev-file-dropzone',
            dragging ? 'is-dragover' : '',
            zoneDisabled ? 'is-disabled' : '',
            hasFiles ? 'has-files' : '',
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
          aria-label={t('appdev.files.dropPrompt')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            className="appdev-media-file-input"
            disabled={zoneDisabled}
            onChange={e => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
            onClick={e => e.stopPropagation()}
          />

          {!hasFiles && (
            <div className="appdev-media-dropzone-body">
              <span className="appdev-media-dropzone-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v12" strokeLinecap="round" />
                  <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" strokeLinecap="round" />
                </svg>
              </span>
              {uploading ? (
                <p className="appdev-media-dropzone-text">{t('appdev.files.uploading')}</p>
              ) : (
                <>
                  <p className="appdev-media-dropzone-text">{t('appdev.files.dropPrompt')}</p>
                  <span className="appdev-media-dropzone-browse">{t('appdev.media.browse')}</span>
                </>
              )}
            </div>
          )}

          {hasFiles && !uploading && (
            <p className="appdev-media-dropzone-replace">{t('appdev.files.addMoreHint')}</p>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="appdev-media-errors" role="alert">
          {errors.map(msg => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      {canManageFiles && (
        <p className="appdev-media-dropzone-hint">{t('appdev.files.dropHint')}</p>
      )}
    </div>
  );
}

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

export default function FileUrlFields({
  fileUrls = [],
  onChangeFiles,
  t,
  disabled = false,
  canManageFiles = true,
  uploadFile = uploadAppdevAttachmentFile,
}) {
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const files = normalizeFileUrls(fileUrls);

  const processFiles = useCallback(
    async rawFiles => {
      if (disabled || !canManageFiles || !rawFiles?.length) return;

      const remaining = FILE_MAX_COUNT - files.length;
      if (remaining <= 0) {
        setErrors([translateFileValidation({ ok: false, error: 'fileLimit' }, t)]);
        return;
      }

      const picked = Array.from(rawFiles).filter(isAllowedAttachmentFile);
      if (!picked.length) {
        setErrors([t('appdev.files.typeError')]);
        return;
      }

      const batch = picked.slice(0, remaining);
      const validationErrors = [];
      const validFiles = [];

      for (const file of batch) {
        const check = await validateAttachmentFileDeep(file);
        if (!check.ok) {
          validationErrors.push(translateFileValidation(check, t));
        } else {
          validFiles.push(file);
        }
      }

      if (!validFiles.length) {
        setErrors(validationErrors);
        return;
      }

      setUploading(true);
      setErrors(validationErrors);
      const uploaded = [];

      try {
        for (const file of validFiles) {
          const entry = await uploadFile(file);
          uploaded.push(entry);
        }
        onChangeFiles([...files, ...uploaded]);
      } catch (err) {
        setErrors(prev => [...prev, err.message || t('appdev.files.uploadFailed')]);
        if (uploaded.length) onChangeFiles([...files, ...uploaded]);
      } finally {
        setUploading(false);
      }
    },
    [disabled, canManageFiles, files, onChangeFiles, t, uploadFile]
  );

  const hasFiles = files.length > 0;

  return (
    <div className="appdev-file-fields">
      {(canManageFiles || hasFiles) && (
        <>
          {canManageFiles && (
            <FileDropzone
              disabled={disabled}
              uploading={uploading}
              canManageFiles={canManageFiles}
              hasFiles={hasFiles}
              errors={errors}
              onFiles={processFiles}
              t={t}
            />
          )}

          <FileList
            files={files}
            canRemove={canManageFiles}
            onRemove={index => onChangeFiles(files.filter((_, i) => i !== index))}
            removeDisabled={disabled || uploading}
            t={t}
          />

          {!canManageFiles && !hasFiles && (
            <p className="appdev-file-empty">{t('appdev.files.empty')}</p>
          )}
        </>
      )}
    </div>
  );
}
