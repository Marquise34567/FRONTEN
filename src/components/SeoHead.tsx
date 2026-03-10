import { useEffect } from "react";

const SITE_URL = "https://www.autoeditor.app";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-landing-page-v1.png`;
const DEFAULT_OG_IMAGE_ALT =
  "AutoEditor landing page preview with creator-focused AI video editing features and workflow highlights.";
const DEFAULT_TWITTER_HANDLE = "@autoeditorapp";
const SEO_JSON_LD_SELECTOR = 'script[data-seo-json-ld="true"]';

type JsonLdPayload = Record<string, unknown> | Array<Record<string, unknown>>;

type SeoHeadProps = {
  title: string;
  description: string;
  path?: string;
  canonicalUrl?: string;
  image?: string;
  imageAlt?: string;
  keywords?: string;
  robots?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
  jsonLd?: JsonLdPayload;
};

const upsertMetaTag = (attribute: "name" | "property", key: string, content: string) => {
  const safeContent = String(content || "").trim();
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", safeContent);
};

const upsertCanonical = (href: string) => {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
};

const removeSeoJsonLd = () => {
  document.head.querySelectorAll(SEO_JSON_LD_SELECTOR).forEach((element) => element.remove());
};

const upsertSeoJsonLd = (jsonLd: JsonLdPayload) => {
  removeSeoJsonLd();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-seo-json-ld", "true");
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
};

const toAbsoluteUrl = (pathOrUrl?: string, fallbackPath?: string) => {
  const rawValue = (pathOrUrl || fallbackPath || "/").trim();
  if (rawValue.startsWith("http://") || rawValue.startsWith("https://")) return rawValue;
  const normalizedPath = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  return new URL(normalizedPath, SITE_URL).toString();
};

const removeKeywordsTag = () => {
  const keywordsTag = document.head.querySelector('meta[name="keywords"]');
  keywordsTag?.remove();
};

const SeoHead = ({
  title,
  description,
  path,
  canonicalUrl,
  image = DEFAULT_OG_IMAGE,
  imageAlt = DEFAULT_OG_IMAGE_ALT,
  keywords,
  robots,
  ogType = "website",
  noindex = false,
  jsonLd,
}: SeoHeadProps) => {
  useEffect(() => {
    const safeTitle = String(title || "").trim();
    const safeDescription = String(description || "").trim();
    const safeRobots = noindex ? "noindex, nofollow" : (robots || "index, follow");
    const absoluteCanonical = toAbsoluteUrl(canonicalUrl, path ?? window.location.pathname);
    const absoluteImage = toAbsoluteUrl(image);

    document.title = safeTitle;
    document.documentElement.setAttribute("lang", "en");

    upsertMetaTag("name", "description", safeDescription);
    upsertMetaTag("name", "robots", safeRobots);
    upsertMetaTag("name", "author", "AutoEditor");
    upsertCanonical(absoluteCanonical);

    upsertMetaTag("property", "og:type", ogType);
    upsertMetaTag("property", "og:site_name", "AutoEditor");
    upsertMetaTag("property", "og:locale", "en_US");
    upsertMetaTag("property", "og:title", safeTitle);
    upsertMetaTag("property", "og:description", safeDescription);
    upsertMetaTag("property", "og:url", absoluteCanonical);
    upsertMetaTag("property", "og:image", absoluteImage);
    upsertMetaTag("property", "og:image:alt", imageAlt);

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:site", DEFAULT_TWITTER_HANDLE);
    upsertMetaTag("name", "twitter:creator", DEFAULT_TWITTER_HANDLE);
    upsertMetaTag("name", "twitter:title", safeTitle);
    upsertMetaTag("name", "twitter:description", safeDescription);
    upsertMetaTag("name", "twitter:url", absoluteCanonical);
    upsertMetaTag("name", "twitter:image", absoluteImage);
    upsertMetaTag("name", "twitter:image:alt", imageAlt);

    if (keywords && keywords.trim().length > 0) {
      upsertMetaTag("name", "keywords", keywords);
    } else {
      removeKeywordsTag();
    }

    if (jsonLd) {
      upsertSeoJsonLd(jsonLd);
      return () => removeSeoJsonLd();
    }

    removeSeoJsonLd();
    return undefined;
  }, [
    canonicalUrl,
    description,
    image,
    imageAlt,
    jsonLd,
    keywords,
    noindex,
    ogType,
    path,
    robots,
    title,
  ]);

  return null;
};

export default SeoHead;
