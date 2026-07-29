/** Channel attribution for retained sources, derived from the origin URL. */
const CHANNEL_BY_HOST: Array<[RegExp, string]> = [
  [/courtlistener\.com$/, "CourtListener"],
  [/govinfo\.gov$/, "GovInfo"],
  [/ecfr\.gov$/, "eCFR"],
  [/law\.cornell\.edu$/, "Cornell LII"],
  [/justia\.com$/, "Justia"],
  [/supremecourt\.gov$/, "Supreme Court"],
  [/congress\.gov$/, "Congress.gov"],
  [/uscourts\.gov$/, "US Courts"],
  [/federalregister\.gov$/, "Federal Register"],
  [/gpo\.gov$/, "GPO"],
];

export function channelFor(resourceUrl: string): string {
  try {
    const host = new URL(resourceUrl).hostname.replace(/^www\./, "");
    for (const [pattern, label] of CHANNEL_BY_HOST) {
      if (pattern.test(host)) return label;
    }
    return host || "Direct";
  } catch {
    return "Direct";
  }
}

/** "statutory_only" → "statutory", "caselaw_leaning" → "caselaw-leaning" */
export function cleanProfile(profile: string | undefined): string {
  if (!profile) return "";
  return profile.replace(/_only$/, "").replace(/_/g, "-");
}
