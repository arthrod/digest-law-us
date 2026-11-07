/**
 * DNS for AI Discovery (draft-mozleywilliams-dnsop-dnsaid-02) for
 * digest.law: ServiceMode SVCB records under `_agents`, so an agent that
 * knows the domain finds the site's agent entry points in DNS.
 *
 *   _index._agents.digest.law  SVCB 1 digest.law. alpn="h2" port=443 …
 *   _mcp._agents.digest.law    SVCB 1 digest.law. alpn="mcp,h2" port=443 …
 *
 * One protocol suite per record (draft §3.1.1). The index points at the site
 * itself, which serves /.well-known/api-catalog, the MCP server card and the
 * agent skills; the MCP record points at the host that answers POST /mcp.
 *
 *   CF_API_TOKEN=… bun scripts/setup-dns-aid.ts           # dry run: the plan
 *   CF_API_TOKEN=… bun scripts/setup-dns-aid.ts --apply   # make it so
 *
 * The token needs Zone → DNS → Edit on digest.law (wrangler's OAuth token
 * does not have it): https://dash.cloudflare.com/profile/api-tokens,
 * template "Edit zone DNS". Re-running is safe: a record that already
 * matches is kept, one that differs is updated, extra copies are deleted.
 * DNSSEC is optional in draft -02 but is what lets an agent trust the
 * answer; the script says when the zone is not signed and leaves it to the
 * owner (dashboard → DNS → Settings → DNSSEC).
 */

export const HOST = "digest.law",
  TTL = 3600;

// oxlint-disable-next-line eslint/one-var -- an exported const cannot join this private list
const API = "https://api.cloudflare.com/client/v4",
  PARAM = /(?<key>[a-z\d-]+)(?:=(?:"(?<quoted>[^"]*)"|(?<bare>\S*)))?/giu;

export interface SvcbRecord {
  data: { priority: number; target: string; value: string };
  name: string;
  ttl: number;
  type: "SVCB";
}

export interface ExistingRecord extends SvcbRecord {
  id: string;
}

export type Action =
  | { kind: "create"; record: SvcbRecord }
  | { id: string; kind: "delete"; record: ExistingRecord }
  | { kind: "keep"; record: ExistingRecord }
  | { id: string; kind: "update"; record: SvcbRecord };

/** The index entry point, then the MCP service: one protocol suite each. */
export function wantedRecords(host: string = HOST): SvcbRecord[] {
  return [
    ["_index", "h2"],
    ["_mcp", "mcp,h2"],
  ].map(([label, alpn]) => ({
    data: {
      priority: 1,
      target: host,
      value: `alpn="${alpn}" port=443 mandatory=alpn,port`,
    },
    name: `${label}._agents.${host}`,
    ttl: TTL,
    type: "SVCB",
  }));
}

/**
 * SvcParams in one spelling: keys sorted, quotes dropped, the mandatory
 * list sorted. The alpn list keeps its order, which is a preference.
 */
function canonicalParams(value: string): string {
  return [...value.matchAll(PARAM)]
    .map((match) => {
      const { bare, key = "", quoted } = match.groups ?? {},
        given = quoted ?? bare ?? "";
      return `${key.toLowerCase()}=${
        key.toLowerCase() === "mandatory"
          ? given.split(",").toSorted().join(",")
          : given
      }`;
    })
    .toSorted()
    .join(" ");
}

function hostname(target: string): string {
  return target.toLowerCase().replace(/\.$/u, "");
}

function matches(record: ExistingRecord, wanted: SvcbRecord): boolean {
  return (
    record.ttl === wanted.ttl &&
    record.data.priority === wanted.data.priority &&
    hostname(record.data.target) === hostname(wanted.data.target) &&
    canonicalParams(record.data.value) === canonicalParams(wanted.data.value)
  );
}

/**
 * What to do so the zone holds each wanted record once: keep one that
 * matches, else update the first under that name, else create it; delete
 * every other copy under the name.
 */
export function plan(
  existing: ExistingRecord[],
  wanted: SvcbRecord[]
): Action[] {
  return wanted.flatMap((record): Action[] => {
    const atName = existing.filter((each) => each.name === record.name),
      exact = atName.find((each) => matches(each, record)),
      survivor = exact ?? atName[0];
    if (!survivor) {
      return [{ kind: "create", record }];
    }
    return [
      exact
        ? { kind: "keep", record: exact }
        : { id: survivor.id, kind: "update", record },
      ...atName
        .filter((each) => each !== survivor)
        .map((each): Action => ({ id: each.id, kind: "delete", record: each })),
    ];
  });
}

export interface RunOptions {
  apply: boolean;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  log: (line: string) => void;
  token: string | undefined;
}

interface Reply {
  errors?: { code: number; message: string }[];
  result?: unknown;
  success?: boolean;
}

type Call = (method: string, path: string, body?: unknown) => Promise<unknown>;

function line(action: Action): string {
  const { name, data } = action.record;
  return `${action.kind.padEnd(6)} ${name} SVCB ${data.priority} ${data.target}. ${data.value}`;
}

/**
 * The body as Cloudflare's JSON envelope; anything else (a proxy's HTML
 * error page, an empty 524) as an empty one, so the HTTP status speaks.
 */
async function replyOf(response: Response): Promise<Reply> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Reply)
      : {};
  } catch {
    return {};
  }
}

/** A Cloudflare API call that throws with Cloudflare's own message, or the
 *  HTTP status when there is none, always naming the call. */
function caller(options: RunOptions, token: string): Call {
  return async (method, path, body) => {
    const response = await options.fetch(`${API}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method,
      }),
      // oxlint-disable-next-line eslint/sort-vars -- reply reads response (TDZ)
      reply = await replyOf(response);
    if (!(response.ok && reply.success)) {
      const reasons = (reply.errors ?? []).map((error) => error.message);
      throw new Error(
        `${method} ${path}: ${reasons.join("; ") || `HTTP ${response.status}`}`
      );
    }
    return reply.result;
  };
}

/** The zone's DNSSEC status and its SVCB records at the wanted names. */
async function current(
  call: Call,
  zoneId: string,
  wanted: SvcbRecord[]
): Promise<{ dnssec: string; existing: ExistingRecord[] }> {
  const [dnssec, lists] = await Promise.all([
    call("GET", `/zones/${zoneId}/dnssec`) as Promise<{ status: string }>,
    Promise.all(
      wanted.map(
        async (record) =>
          (await call(
            "GET",
            `/zones/${zoneId}/dns_records?type=SVCB&name=${encodeURIComponent(record.name)}`
          )) as ExistingRecord[]
      )
    ),
  ]);
  return { dnssec: dnssec.status, existing: lists.flat() };
}

/** The plan's writes, one at a time and in order: a failure stops the rest. */
async function change(call: Call, zoneId: string, actions: Action[]) {
  const records = `/zones/${zoneId}/dns_records`;
  /* oxlint-disable no-await-in-loop -- one change at a time, in plan order */
  for (const action of actions) {
    if (action.kind === "create") {
      await call("POST", records, action.record);
    } else if (action.kind === "update") {
      await call("PUT", `${records}/${action.id}`, action.record);
    } else if (action.kind === "delete") {
      await call("DELETE", `${records}/${action.id}`);
    }
  }
  /* oxlint-enable no-await-in-loop */
}

/** The exit code: 0 when the records are (or, dry, would be) in place. */
export async function run(options: RunOptions): Promise<number> {
  const { log, token } = options;
  if (!token) {
    log(
      `CF_API_TOKEN is not set. It needs a Cloudflare API token with Zone → DNS → Edit on ${HOST} (template "Edit zone DNS").`
    );
    return 1;
  }
  try {
    const call = caller(options, token),
      [zone] = (await call("GET", `/zones?name=${HOST}`)) as { id: string }[];
    if (!zone) {
      log(`no zone ${HOST} is visible to this token`);
      return 1;
    }
    // oxlint-disable-next-line eslint/one-var -- reads the zone found above
    const desired = wantedRecords(),
      { dnssec, existing } = await current(call, zone.id, desired),
      steps = plan(existing, desired);
    if (dnssec !== "active") {
      log(
        `DNSSEC is ${dnssec} on ${HOST}: agents cannot validate these records until it is enabled (dashboard → DNS → Settings → DNSSEC).`
      );
    }
    for (const step of steps) {
      log(line(step));
    }
    if (!options.apply) {
      log(
        "dry run: nothing written. Run again with --apply to make these changes."
      );
      return 0;
    }
    await change(call, zone.id, steps);
    log(`done. Check: dig SVCB _index._agents.${HOST} +dnssec @1.1.1.1`);
    return 0;
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) {
  process.exit(
    await run({
      apply: process.argv.includes("--apply"),
      fetch,
      log: console.log,
      token: process.env.CF_API_TOKEN,
    })
  );
}
