/** The text of a shopping list for a chat message: a title, one bullet per product, a footer. */
export function shoppingText(title: string, lines: string[], footer: string): string {
  const items = lines.map((l) => l.trim()).filter(Boolean)
  return [`🛒 ${title}`, ...items.map((l) => `• ${l}`), '', footer].join('\n')
}

/** Links that open the messengers with the text ready to send. */
export function shareLinks(text: string, siteUrl: string) {
  const q = encodeURIComponent(text)
  return {
    telegram: `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${q}`,
    viber: `viber://forward?text=${q}`,
    whatsapp: `https://wa.me/?text=${q}`,
  }
}
