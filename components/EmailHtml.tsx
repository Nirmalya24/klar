"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EmailTheme = "light" | "dark";

type EmailHtmlProps = {
  html: string;
  theme: EmailTheme;
};

type SanitizedEmail = {
  html: string;
  simple: boolean;
};

const PRESERVED_ATTRIBUTES = new Set([
  "href",
  "src",
  "srcset",
  "alt",
  "title"
]);

function sanitizeNodeAttributes(element: Element, simple: boolean) {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim().toLowerCase();

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (simple && !PRESERVED_ATTRIBUTES.has(name) && name !== "target" && name !== "rel") {
      element.removeAttribute(attribute.name);
    }
  }

  if (element instanceof HTMLAnchorElement) {
    element.target = "_blank";
    element.rel = "noreferrer noopener";
  }
}

function parsePixelSize(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function isTrackingImage(element: Element) {
  if (!(element instanceof HTMLImageElement)) return false;

  const widthAttr = parsePixelSize(element.getAttribute("width"));
  const heightAttr = parsePixelSize(element.getAttribute("height"));
  const style = (element.getAttribute("style") || "").toLowerCase();
  const src = (element.getAttribute("src") || "").toLowerCase();

  const naturalWidth = element.naturalWidth > 0 ? element.naturalWidth : null;
  const naturalHeight = element.naturalHeight > 0 ? element.naturalHeight : null;
  const width = widthAttr ?? parsePixelSize(element.style.width) ?? naturalWidth;
  const height = heightAttr ?? parsePixelSize(element.style.height) ?? naturalHeight;
  const tinyByDimensions =
    (width !== null && width <= 4 && (!height || height <= 4)) ||
    (height !== null && height <= 4 && (!width || width <= 4));
  const tinyByStyle =
    style.includes("width:1px") ||
    style.includes("height:1px") ||
    style.includes("width: 1px") ||
    style.includes("height: 1px");
  const trackingSource =
    src.includes("/open?") ||
    src.includes("tracking") ||
    src.includes("pixel") ||
    src.includes("sendgrid.net/wf/open");

  return tinyByDimensions || tinyByStyle || trackingSource;
}

function isSimpleEmail(document: Document) {
  const visualImages = [...document.querySelectorAll("img")].filter((element) => !isTrackingImage(element));
  const otherVisuals = document.querySelectorAll("svg, canvas, video").length;
  const tables = document.querySelectorAll("table").length;
  const styledNodes = document.querySelectorAll("[style], style").length;
  const bodyText = document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const textLength = bodyText.length;

  return visualImages.length === 0 && otherVisuals === 0 && tables === 0 && styledNodes <= 12 && textLength > 0 && textLength < 12000;
}

function normalizeSimpleEmail(document: Document) {
  for (const element of document.querySelectorAll(
    "script, iframe, object, embed, form, input, button, textarea, select, style, head, meta, link"
  )) {
    element.remove();
  }

  for (const element of document.querySelectorAll("*")) {
    sanitizeNodeAttributes(element, true);

    if (element instanceof HTMLElement) {
      const tag = element.tagName.toLowerCase();
      if (tag === "body") continue;

      if (["font", "center"].includes(tag)) {
        const replacement = document.createElement("div");
        replacement.innerHTML = element.innerHTML;
        element.replaceWith(replacement);
      }
    }

    if (isTrackingImage(element)) {
      element.remove();
    }
  }

  const body = document.body;
  if (!body) return "";

  body.querySelectorAll("br + br").forEach((node) => {
    const parent = node.parentElement;
    if (parent?.tagName.toLowerCase() === "p") return;
  });

  return body.innerHTML.trim();
}

function sanitizeRichEmail(document: Document) {
  for (const element of document.querySelectorAll(
    "script, iframe, object, embed, form, input, button, textarea, select"
  )) {
    element.remove();
  }

  for (const element of document.querySelectorAll("*")) {
    sanitizeNodeAttributes(element, false);
  }

  return document.body?.innerHTML?.trim() || document.documentElement.innerHTML || "";
}

function buildSimpleEmailDocument(content: string, theme: EmailTheme) {
  const dark = theme === "dark";
  const background = dark ? "#081120" : "#f8fafc";
  const panel = dark ? "#0f1b2d" : "#ffffff";
  const text = dark ? "#dbe7f5" : "#334155";
  const heading = dark ? "#f8fafc" : "#0f172a";
  const border = dark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.08)";
  const link = dark ? "#7dd3fc" : "#2563eb";
  const quote = dark ? "#94a3b8" : "#64748b";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: ${theme}; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${background};
        color: ${text};
        font: 16px/1.75 Inter, ui-sans-serif, system-ui, sans-serif;
      }
      body {
        padding: 24px;
      }
      .mail-shell {
        max-width: 860px;
        margin: 0 auto;
        padding: 28px 30px;
        border-radius: 22px;
        border: 1px solid ${border};
        background: ${panel};
        box-shadow: ${dark ? "0 24px 60px rgba(2,6,23,0.35)" : "0 16px 40px rgba(15,23,42,0.08)"};
      }
      p, div, li {
        color: ${text};
      }
      p, ul, ol, blockquote, h1, h2, h3, h4, h5, h6 {
        margin: 0 0 18px;
      }
      h1, h2, h3, h4, h5, h6, strong, b {
        color: ${heading};
      }
      a {
        color: ${link};
        text-decoration: underline;
        text-decoration-thickness: 1.5px;
      }
      blockquote {
        margin-left: 0;
        padding-left: 18px;
        border-left: 2px solid ${border};
        color: ${quote};
      }
      hr {
        border: 0;
        border-top: 1px solid ${border};
        margin: 24px 0;
      }
      ul, ol {
        padding-left: 22px;
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      * {
        max-width: 100%;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <article class="mail-shell">${content}</article>
  </body>
</html>`;
}

function buildRichEmailDocument(content: string, theme: EmailTheme) {
  const dark = theme === "dark";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: ${theme}; }
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
      body {
        padding: 8px 0;
        overflow-wrap: anywhere;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      table {
        max-width: 100% !important;
      }
      a {
        color: ${dark ? "#7dd3fc" : "#2563eb"};
      }
      blockquote {
        margin-left: 0;
        padding-left: 16px;
        border-left: 2px solid ${dark ? "#334155" : "#cbd5e1"};
        color: ${dark ? "#94a3b8" : "#64748b"};
      }
      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

function sanitizeHtmlDocument(source: string, theme: EmailTheme): SanitizedEmail {
  if (typeof window === "undefined") {
    return {
      html: source,
      simple: false
    };
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(source, "text/html");
  const simple = isSimpleEmail(document);
  const content = simple ? normalizeSimpleEmail(document) : sanitizeRichEmail(document);

  return {
    html: simple ? buildSimpleEmailDocument(content, theme) : buildRichEmailDocument(content, theme),
    simple
  };
}

export default function EmailHtml({ html, theme }: EmailHtmlProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(240);

  const sanitized = useMemo(() => sanitizeHtmlDocument(html, theme), [html, theme]);

  useEffect(() => {
    let observer: ResizeObserver | null = null;

    function resizeFrame() {
      const frame = frameRef.current;
      if (!frame) return;

      try {
        const document = frame.contentDocument;
        if (!document) return;
        const nextHeight = Math.max(
          document.body?.scrollHeight ?? 0,
          document.documentElement?.scrollHeight ?? 0,
          sanitized.simple ? 180 : 240
        );
        setHeight(nextHeight);
      } catch {
        setHeight(420);
      }
    }

    const handleLoad = () => {
      const frame = frameRef.current;
      if (!frame) return;

      resizeFrame();
      try {
        observer?.disconnect();
        observer = new ResizeObserver(() => resizeFrame());
        if (frame.contentDocument?.body) {
          observer.observe(frame.contentDocument.body);
        }
      } catch {
        observer = null;
      }
    };

    const frame = frameRef.current;
    if (!frame) return;

    frame.addEventListener("load", handleLoad);
    resizeFrame();

    return () => {
      observer?.disconnect();
      frame.removeEventListener("load", handleLoad);
    };
  }, [sanitized]);

  return (
    <iframe
      ref={frameRef}
      title="Email content"
      srcDoc={sanitized.html}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      className={`w-full rounded-xl ${sanitized.simple ? "bg-transparent" : theme === "dark" ? "bg-slate-950" : "bg-white"}`}
      style={{ height }}
    />
  );
}
