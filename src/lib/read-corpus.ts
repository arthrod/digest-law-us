import { promises as fs } from "node:fs";

/**
 * Read a corpus file, or `null` if it no longer exists.
 *
 * The corpus is a live checkout of key-digest-runner: researchers commit to
 * it, the runner is pulled and `corpus:clean` deletes from it, all while a
 * full build runs for most of a day. A file listed at the start of content
 * sync can be gone by the time it is read (2026-11-25: a purged bundle's
 * source killed the build with ENOENT). One vanished file must cost one
 * entry, not the build, so ENOENT and ENOTDIR (a deleted parent folder) are
 * reported as `null`; every other error still throws.
 */
export async function readCorpusFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return null;
    }
    throw error;
  }
}

/**
 * Recursive listing of the corpus. A folder deleted while Node walks the tree
 * makes `readdir` fail with ENOENT; the walk is simply retried, since the next
 * pass no longer sees that folder.
 */
export async function listCorpus(
  root: string,
  attempts = 5
): Promise<string[]> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fs.readdir(root, { recursive: true });
    } catch (error) {
      const { code } = error as NodeJS.ErrnoException;
      if (code !== "ENOENT" || attempt >= attempts) {
        throw error;
      }
    }
  }
}
