/** Channel attribution for retained sources, derived from the origin URL. */
const CHANNEL_BY_HOST: [RegExp, string][] = [
  [/courtlistener\.com$/u, "CourtListener"],
  [/govinfo\.gov$/u, "GovInfo"],
  [/ecfr\.gov$/u, "eCFR"],
  [/law\.cornell\.edu$/u, "Cornell LII"],
  [/justia\.com$/u, "Justia"],
  [/supremecourt\.gov$/u, "Supreme Court"],
  [/congress\.gov$/u, "Congress.gov"],
  [/uscourts\.gov$/u, "US Courts"],
  [/federalregister\.gov$/u, "Federal Register"],
  [/gpo\.gov$/u, "GPO"],
];

export function channelFor(resourceUrl: string): string {
  try {
    const host = new URL(resourceUrl).hostname.replace(/^www\./u, "");
    for (const [pattern, label] of CHANNEL_BY_HOST) {
      if (pattern.test(host)) {
        return label;
      }
    }
    return host || "Direct";
  } catch {
    return "Direct";
  }
}

/** "statutory_only" → "statutory", "caselaw_leaning" → "caselaw-leaning" */
export function cleanProfile(profile: string | undefined): string {
  if (!profile) {
    return "";
  }
  return profile.replace(/_only$/u, "").replaceAll("_", "-");
}
