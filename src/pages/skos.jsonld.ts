/**
 * Machine-readable SKOS concept scheme for the whole corpus — the
 * ConceptScheme plus every concept (areas, containers, digests) with its
 * permanent w3id identifier. SKOS best practice: publish the scheme, not
 * just the pages.
 */
import type { APIRoute } from "astro";
import { getCorpus } from "@/lib/corpus";
import { schemeJsonLd } from "@/lib/skos";

export const GET: APIRoute = async () => {
  const corpus = await getCorpus();
  return new Response(schemeJsonLd(corpus), {
    headers: { "Content-Type": "application/ld+json; charset=utf-8" },
  });
};
