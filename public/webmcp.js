/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/): offers digest.law's
 * read-only MCP tools to a browser agent through navigator.modelContext.
 * Every tool is a tools/call to POST /mcp, so what a tool does lives in one
 * place (worker/mcp.ts). Browsers without WebMCP skip all of it and send
 * nothing.
 *
 * Every page loads this file (Layout.astro), and it ships with the root
 * Worker: a change here is a root-only deploy, not a rebuild. The tools must
 * match /mcp's tools/list; worker/webmcp.test.ts compares them.
 *
 * registerTool is the API; provideContext, which the spec is dropping
 * (webmachinelearning/webmcp#101), is used only where registerTool is absent.
 */
/* oxlint-disable unicorn/consistent-function-scoping -- a classic script: a function outside the IIFE would be a global */
(() => {
  const asError = (text) => ({
      content: [{ text, type: "text" }],
      isError: true,
    }),
    call = async (name, args) => {
      try {
        const response = await fetch("/mcp", {
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "tools/call",
              params: { arguments: args ?? {}, name },
            }),
            headers: {
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
            },
            method: "POST",
          }),
          // oxlint-disable-next-line eslint/sort-vars -- reply reads response (TDZ)
          reply = await response.json();
        if (reply?.result) {
          return reply.result;
        }
        return asError(reply?.error?.message ?? `HTTP ${response.status}`);
      } catch (error) {
        return asError(`The request to /mcp failed: ${String(error)}`);
      }
    },
    context = navigator.modelContext,
    limit = { default: 20, maximum: 50, minimum: 1, type: "integer" },
    tool = (name, description, inputSchema) => ({
      annotations: { readOnlyHint: true },
      description,
      execute: (args) => call(name, args),
      inputSchema,
      name,
    }),
    tools = [
      tool(
        "search_concepts",
        "Search the concept catalog by label or route (substring, case-insensitive). Returns matching concepts with their pages. Does not search the full text of a digest.",
        {
          properties: {
            include_retired: {
              default: false,
              description: "Include tombstoned concepts. Off by default.",
              type: "boolean",
            },
            limit,
            query: {
              description: "Words from a concept label or route.",
              type: "string",
            },
          },
          required: ["query"],
          type: "object",
        }
      ),
      tool(
        "list_concepts",
        "List concepts in catalog order, optionally limited to one area (the first path segment, or a longer route prefix).",
        {
          properties: {
            area: {
              description: "Route prefix, e.g. evidence-law.",
              type: "string",
            },
            include_retired: { default: false, type: "boolean" },
            limit,
            page: { default: 1, minimum: 1, type: "integer" },
          },
          type: "object",
        }
      ),
      tool(
        "get_concept",
        "Fetch one concept by its 32-character id or its current route. Returns the page URL and the permanent concept IRI.",
        {
          properties: {
            id: { description: "32 lowercase hex concept id.", type: "string" },
            route: {
              description:
                "Current route, e.g. evidence-law/proof-of-writings.",
              type: "string",
            },
          },
          type: "object",
        }
      ),
    ];

  if (!context) {
    return;
  }
  if (typeof context.registerTool === "function") {
    for (const each of tools) {
      try {
        context.registerTool(each);
      } catch {
        // Already registered by an earlier page of this visit.
      }
    }
  } else if (typeof context.provideContext === "function") {
    try {
      context.provideContext({ tools });
    } catch {
      // An older draft of the API with another shape: leave it.
    }
  }
})();
