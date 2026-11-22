/**
 * Some machine-written digests repeat the heading marker inside the heading:
 * `## ## Checklist of concrete steps` (the writer was told to add a
 * `## Checklist` and wrote the marker twice). Markdown reads the second `##`
 * as text, so the page shows a heading that starts with a literal "## ".
 *
 * A heading never legitimately opens with `#`-marks followed by a space, so
 * every such run is stripped from the start of the heading's text. The corpus
 * file is left as written; this only changes what is published.
 */
interface MdNode {
  children?: MdNode[];
  type: string;
  value?: string;
}

const STRAY_MARKERS = /^(?:\s*#{1,6}\s+)+/u;

function firstText(node: MdNode): MdNode | undefined {
  if (node.type === "text") {
    return node;
  }
  const [first] = node.children ?? [];
  return first ? firstText(first) : undefined;
}

export function stripStrayHeadingMarkers(value: string): string {
  return value.replace(STRAY_MARKERS, "");
}

function visit(node: MdNode): void {
  if (node.type === "heading") {
    const text = firstText(node);
    if (text && typeof text.value === "string") {
      text.value = stripStrayHeadingMarkers(text.value);
    }
    return;
  }
  for (const child of node.children ?? []) {
    visit(child);
  }
}

export function remarkFixHeadingMarkers() {
  return (tree: MdNode) => {
    visit(tree);
  };
}
