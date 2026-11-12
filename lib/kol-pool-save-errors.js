/** Map KOL pool create/save API errors to i18n keys for toast messages. */

export function kolPoolSaveErrorMessage(body, t) {
  const code = String(body?.error || '').trim();
  if (code === 'channel_name_required') return t('hub.kol.channelRequired');
  if (code === 'channel_name_duplicate') return t('hub.kol.channelDuplicate');
  return null;
}
