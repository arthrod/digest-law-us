/**
 * schema.org JSON-LD for search engines and agents: who publishes the site
 * (Organization), how to search it (WebSite with a SearchAction), and where
 * a page sits (BreadcrumbList). The Article on a digest page is built in
 * skos.ts, beside the concept it is about, from the values here.
 * scripts/check-head.ts checks the built pages for all of it.
 */
import { SCHEME_LANGUAGE, SITE_BASE } from "./iri";

/* oxlint-disable eslint/sort-vars -- ORGANIZATION reads SITE_NAME, so SITE_NAME comes first (TDZ) */
/** The site's name, as every page and the feed give it. */
export const SITE_NAME = "American Legal Digest",
  /** The content license (README, SiteFooter.astro); the code is Apache-2.0. */
  CONTENT_LICENSE = "https://creativecommons.org/licenses/by/4.0/",
  /** The publisher, one node that every page refers to by its @id. */
  ORGANIZATION = {
    "@id": `${SITE_BASE}#organization`,
    "@type": "Organization",
    logo: `${SITE_BASE}favicon.svg`,
    name: SITE_NAME,
    url: SITE_BASE,
  },
  SCHEMA_ORG = "https://schema.org",
  /** /search/ reads ?q= and runs that search on load (search.astro). */
  SEARCH_URL_TEMPLATE = `${SITE_BASE}search/?q={search_term_string}`,
  WEBSITE_ID = `${SITE_BASE}#website`;
/* oxlint-enable eslint/sort-vars */

export interface Crumb {
  /** Absent for a crumb without a page, and for the current page. */
  href?: string;
  label: string;
}

/** JSON for a <script> element: "<" is escaped, so no value can close it. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function organizationJsonLd(): string {
  return scriptJson({ "@context": SCHEMA_ORG, ...ORGANIZATION });
}

export function websiteJsonLd(): string {
  return scriptJson({
    "@context": SCHEMA_ORG,
    "@id": WEBSITE_ID,
    "@type": "WebSite",
    inLanguage: SCHEME_LANGUAGE,
    name: SITE_NAME,
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: { "@type": "EntryPoint", urlTemplate: SEARCH_URL_TEMPLATE },
    },
    publisher: { "@id": ORGANIZATION["@id"] },
    url: SITE_BASE,
  });
}

/**
 * A BreadcrumbList for a page's crumbs; null when there is no trail. A crumb
 * with no page has no URL to give, so it is left out rather than listed
 * without one; the current page, last, needs none.
 */
export function breadcrumbJsonLd(crumbs: Crumb[]): string | null {
  const kept = crumbs.filter(
    (crumb, index) => crumb.href || index === crumbs.length - 1
  );
  if (kept.length < 2) {
    return null;
  }
  return scriptJson({
    "@context": SCHEMA_ORG,
    "@type": "BreadcrumbList",
    itemListElement: kept.map((crumb, index) => ({
      "@type": "ListItem",
      ...(crumb.href ? { item: new URL(crumb.href, SITE_BASE).href } : {}),
      name: crumb.label,
      position: index + 1,
    })),
  });
}
