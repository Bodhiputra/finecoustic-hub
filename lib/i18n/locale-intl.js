/** Map hub locale codes to BCP 47 tags for Intl formatters. */
export function intlLocaleForHub(locale = 'en') {
  if (locale === 'zh') return 'zh-CN';
  if (locale === 'id') return 'id-ID';
  return 'en-GB';
}

export function htmlLangForHub(locale = 'en') {
  if (locale === 'zh') return 'zh-CN';
  if (locale === 'id') return 'id';
  return 'en';
}
