/**
 * The review committee, and the contact topics that route to it.
 *
 * This module is the single source of truth for three consumers: the
 * /committee/ page, the /contact/ form, and the Worker that turns a
 * submission into mail (worker/index.ts imports TOPICS from here, so the
 * select on the page and the routing table in the Worker cannot drift).
 *
 * Keep it dependency-free — the Worker bundle pulls it in directly and must
 * not drag Astro or Node APIs along with it.
 */

export interface Reviewer {
  /** degrees, most recent first — school and year as awarded */
  credentials: string[];
  email: string;
  name: string;
  /**
   * One line on who they are. Sourced from public profiles; correct it here
   * rather than in the page, and keep it to something a reader could check.
   */
  oneLiner: string;
  /** where they practise, for the "local and global" point */
  based: string;
  role: string;
}

export const REVIEWERS: Reviewer[] = [
  {
    based: "New York",
    credentials: [
      "J.D., University of Michigan Law School, 2019",
      "LL.M., University of Michigan Law School, 2012",
    ],
    email: "arthur@digest.law",
    name: "Arthur Souza Rodrigues",
    oneLiner:
      "Corporate lawyer working where legal advice meets execution — contracts, governance, privacy and AI adoption, plus the software layer that makes the work repeatable.",
    role: "Editor and reviewer",
  },
  {
    based: "Brazil",
    credentials: ["LL.M., Cornell Law School, 2023"],
    email: "carolina@digest.law",
    name: "Carolina Machado Brigagão",
    oneLiner:
      "Over a decade of Brazilian and cross-border practice, now in-house at the global energy and commodities trader Vitol.",
    role: "Reviewer",
  },
];

export interface ContactTopic {
  /** submitted value — also the Worker's routing key */
  id: string;
  label: string;
  /** committee addresses this topic is delivered to */
  to: string[];
}

const ARTHUR = "arthur@digest.law";
const CAROLINA = "carolina@digest.law";

/**
 * Topic router. Anything that touches the corpus itself reaches both
 * reviewers; everything else reaches the editor. The Worker rejects any
 * topic id absent from this list, so the recipient set is closed by
 * construction — a submitted address can never become a recipient.
 */
export const TOPICS: ContactTopic[] = [
  {
    id: "correction",
    label: "Correction to a digest",
    to: [ARTHUR, CAROLINA],
  },
  {
    id: "reviewer",
    label: "Apply to review (local or global)",
    to: [ARTHUR, CAROLINA],
  },
  {
    id: "source",
    label: "Source, licensing or takedown",
    to: [ARTHUR],
  },
  {
    id: "research",
    label: "Research, press or data access",
    to: [ARTHUR],
  },
  {
    id: "other",
    label: "Something else",
    to: [ARTHUR],
  },
];

export function topicById(id: string): ContactTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** Field limits, enforced on both sides of the wire. */
export const LIMITS = {
  email: 200,
  message: 5000,
  name: 120,
  organization: 160,
} as const;
