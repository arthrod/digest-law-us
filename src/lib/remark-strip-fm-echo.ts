/**
 * ~30 shipped digests carry an unfenced echo of their own SKOS frontmatter at
 * the top of the body: the closing `---` of the real block is followed by the
 * same YAML again, so gray-matter strips only the first copy and the second
 * renders as prose (its last lines even parse as a setext h2, since the
 * terminating `---` sits flush under them). The echo always precedes the
 * digest's first `# ` heading, and clean digests always open with a heading —
 * so: when the document opens with an `okf_version:` paragraph, drop every
 * node before the first depth-1 heading. The frontmatter itself is untouched;
 * DigestView renders it as the SKOS record in the rail.
 */
type MdNode = {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
};

function leadingText(node: MdNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return leadingText(node.children?.[0]);
}

export function remarkStripFmEcho() {
  return (tree: MdNode) => {
    const children = tree.children ?? [];
    const first = children[0];
    if (first?.type !== "paragraph") return;
    if (!/^\s*okf_version\s*:/.test(leadingText(first))) return;
<<<<<<< HEAD
    const h1 = children.findIndex(n => n.type === "heading" && n.depth === 1);
=======
    const h1 = children.findIndex((n) => n.type === "heading" && n.depth === 1);
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
    if (h1 > 0) tree.children = children.slice(h1);
  };
}
