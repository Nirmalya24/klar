function decodeQuotedPrintable(value: string) {
  if (!/(?:=[\da-fA-F]{2}|=\r?\n)/.test(value)) {
    return value;
  }

  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([\da-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function decodeEmailFragment(value: string) {
  return decodeQuotedPrintable(value).replace(/\u0000/g, "").trim();
}

export function looksLikeHtml(value: string) {
  const sample = value.trim().slice(0, 400).toLowerCase();
  return /<(?:!doctype|html|body|head|div|table|span|p|a|img|style|meta|br)\b/.test(sample);
}

export function stripHtmlMarkup(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|section|article|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeEmailBodies(input: { bodyText: string; bodyHtml: string | null }) {
  const decodedText = decodeEmailFragment(input.bodyText);
  const decodedHtml = input.bodyHtml ? decodeEmailFragment(input.bodyHtml) : "";

  if (decodedHtml) {
    return {
      bodyHtml: decodedHtml,
      bodyText: decodedText && !looksLikeHtml(decodedText) ? decodedText : stripHtmlMarkup(decodedHtml)
    };
  }

  if (decodedText && looksLikeHtml(decodedText)) {
    return {
      bodyHtml: decodedText,
      bodyText: stripHtmlMarkup(decodedText)
    };
  }

  return {
    bodyHtml: null,
    bodyText: decodedText
  };
}
