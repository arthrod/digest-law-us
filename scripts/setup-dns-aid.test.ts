/**
 * The DNS-AID script: the records it wants, the plan it makes against what
 * the zone holds, and a run against a fake Cloudflare API.
 */
import { describe, expect, test } from "bun:test";

import { plan, run, wantedRecords } from "./setup-dns-aid";
import type { ExistingRecord, SvcbRecord } from "./setup-dns-aid";

const API = "https://api.cloudflare.com/client/v4",
  ZONE_ID = "zone123";

interface Call {
  body: unknown;
  method: string;
  url: string;
}

function existing(
  record: SvcbRecord,
  id: string,
  change: Partial<SvcbRecord["data"]> = {}
): ExistingRecord {
  return { ...record, data: { ...record.data, ...change }, id };
}

function ok(result: unknown): Response {
  return Response.json({ errors: [], result, success: true });
}

/** A Cloudflare API with one zone, its DNSSEC status and its SVCB records. */
function fakeApi(
  options: {
    dnssec?: string;
    records?: ExistingRecord[];
    write?: (call: Call) => Response;
    zones?: { id: string; name: string }[];
  } = {}
) {
  const calls: Call[] = [],
    records = options.records ?? [],
    zones = options.zones ?? [{ id: ZONE_ID, name: "digest.law" }];
  function read(url: string): Response {
    const { pathname, searchParams } = new URL(url),
      name = searchParams.get("name");
    if (pathname.endsWith("/zones")) {
      return ok(zones.filter((zone) => zone.name === name));
    }
    if (pathname.endsWith("/dnssec")) {
      return ok({ status: options.dnssec ?? "active" });
    }
    return ok(records.filter((record) => record.name === name));
  }
  function fetcher(url: string, init?: RequestInit): Promise<Response> {
    const method = init?.method ?? "GET",
      request = {
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        method,
        url,
      };
    calls.push(request);
    return Promise.resolve(
      method === "GET" ? read(url) : (options.write?.(request) ?? ok({}))
    );
  }
  return { calls, fetcher };
}

async function runWith(
  api: ReturnType<typeof fakeApi>,
  options: { apply?: boolean; token?: string } = {}
) {
  const lines: string[] = [],
    status = await run({
      apply: options.apply ?? false,
      fetch: api.fetcher,
      log: (line) => lines.push(line),
      token: "token" in options ? options.token : "secret",
    });
  return { code: status, output: lines.join("\n") };
}

function writes(calls: Call[]): Call[] {
  return calls.filter((call) => call.method !== "GET");
}

describe("wantedRecords", () => {
  test("an index and an MCP entry point under _agents, ServiceMode, on 443", () => {
    expect(wantedRecords()).toEqual([
      {
        data: {
          priority: 1,
          target: "digest.law",
          value: 'alpn="h2" port=443 mandatory=alpn,port',
        },
        name: "_index._agents.digest.law",
        ttl: 3600,
        type: "SVCB",
      },
      {
        data: {
          priority: 1,
          target: "digest.law",
          value: 'alpn="mcp,h2" port=443 mandatory=alpn,port',
        },
        name: "_mcp._agents.digest.law",
        ttl: 3600,
        type: "SVCB",
      },
    ]);
  });
});

describe("plan", () => {
  const [index, mcp] = wantedRecords() as [SvcbRecord, SvcbRecord];

  test("an empty zone gets both records", () => {
    expect(plan([], [index, mcp])).toEqual([
      { kind: "create", record: index },
      { kind: "create", record: mcp },
    ]);
  });

  test("a record that matches is kept, however Cloudflare spells it", () => {
    const spelled = existing(index, "a", {
      target: "digest.law.",
      value: 'mandatory="alpn,port" alpn="h2" port="443"',
    });
    expect(plan([spelled], [index])).toEqual([
      { kind: "keep", record: spelled },
    ]);
  });

  test("a record that differs is updated in place", () => {
    const stale = existing(mcp, "b", { value: 'alpn="h2" port=443' });
    expect(plan([stale], [mcp])).toEqual([
      { id: "b", kind: "update", record: mcp },
    ]);
  });

  test("a different TTL is a difference", () => {
    const short = { ...existing(index, "c"), ttl: 300 };
    expect(plan([short], [index])).toEqual([
      { id: "c", kind: "update", record: index },
    ]);
  });

  test("extra copies are deleted, and a matching one is the one kept", () => {
    const copy = existing(index, "copy"),
      good = existing(index, "good"),
      stale = existing(index, "old", { value: 'alpn="h3" port=443' });
    expect(plan([stale, good, copy], [index])).toEqual([
      { kind: "keep", record: good },
      { id: "old", kind: "delete", record: stale },
      { id: "copy", kind: "delete", record: copy },
    ]);
  });
});

describe("run", () => {
  test("without a token it explains what token it needs and exits 1", async () => {
    const api = fakeApi(),
      { code, output } = await runWith(api, { token: undefined });
    expect(output).toContain("CF_API_TOKEN");
    expect(output).toContain("Zone → DNS → Edit");
    expect(api.calls).toEqual([]);
    expect(code).toBe(1);
  });

  test("a dry run prints the plan and writes nothing", async () => {
    const api = fakeApi(),
      { code, output } = await runWith(api);
    expect(output).toContain("create _index._agents.digest.law");
    expect(output).toContain("create _mcp._agents.digest.law");
    expect(output).toContain("--apply");
    expect(writes(api.calls)).toEqual([]);
    expect(code).toBe(0);
  });

  test("--apply creates what is missing, with the token", async () => {
    const api = fakeApi(),
      { code } = await runWith(api, { apply: true });
    expect(writes(api.calls)).toEqual([
      {
        body: wantedRecords()[0],
        method: "POST",
        url: `${API}/zones/${ZONE_ID}/dns_records`,
      },
      {
        body: wantedRecords()[1],
        method: "POST",
        url: `${API}/zones/${ZONE_ID}/dns_records`,
      },
    ]);
    expect(code).toBe(0);
  });

  test("--apply updates and deletes by id, and keeps what matches", async () => {
    const [index, mcp] = wantedRecords() as [SvcbRecord, SvcbRecord],
      api = fakeApi({
        records: [
          existing(index, "i1"),
          existing(index, "i2"),
          existing(mcp, "m1", { value: 'alpn="h2"' }),
        ],
      });
    await runWith(api, { apply: true });
    expect(
      writes(api.calls).map((call) => `${call.method} ${call.url}`)
    ).toEqual([
      `DELETE ${API}/zones/${ZONE_ID}/dns_records/i2`,
      `PUT ${API}/zones/${ZONE_ID}/dns_records/m1`,
    ]);
  });

  test("every request carries the token as a bearer", async () => {
    const api = fakeApi(),
      logged: string[] = [],
      seen: string[] = [];
    await run({
      apply: true,
      fetch: async (url, init) => {
        seen.push(String(new Headers(init?.headers).get("authorization")));
        return await api.fetcher(url, init);
      },
      log: (line) => logged.push(line),
      token: "secret",
    });
    expect(new Set(seen)).toEqual(new Set(["Bearer secret"]));
  });

  test("an unsigned zone is reported, and the records still go in", async () => {
    const api = fakeApi({ dnssec: "disabled" }),
      { code, output } = await runWith(api, { apply: true });
    expect(output).toContain("DNSSEC is disabled");
    expect(writes(api.calls)).toHaveLength(2);
    expect(code).toBe(0);
  });

  test("a zone the token cannot see is an error", async () => {
    const api = fakeApi({ zones: [] }),
      { code, output } = await runWith(api);
    expect(output).toContain("no zone digest.law");
    expect(code).toBe(1);
  });

  test("a refused write is reported with Cloudflare's message, and exits 1", async () => {
    const api = fakeApi({
        write: () =>
          Response.json(
            {
              errors: [{ code: 10_000, message: "Authentication error" }],
              success: false,
            },
            { status: 403 }
          ),
      }),
      { code, output } = await runWith(api, { apply: true });
    expect(output).toContain("Authentication error");
    expect(code).toBe(1);
  });
});
