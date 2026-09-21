/** Map hub locale codes to BCP 47 tags for Intl formatters. */
export function intlLocaleForHub(locale = 'en') {
  if (locale === 'zh') return 'zh-CN';
  return 'en-GB';
}

export function htmlLangForHub(locale = 'en') {
  if (locale === 'zh') return 'zh-CN';
  return 'en';
}
