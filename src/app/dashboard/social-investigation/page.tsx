"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { useMemo, useState } from "react";

type SocialResult = Record<string, unknown>;

type DeSearchAttempt = {
  method: "GET" | "POST";
  path: string;
  status: number | null;
};

type DeSearchDiagnostics = {
  strategy: string;
  selectedRoute: { method: "GET" | "POST"; path: string } | null;
  attempts: DeSearchAttempt[];
};

type SearchResponse = {
  compiledQuery: string;
  count: number;
  results: SocialResult[];
  diagnostics?: DeSearchDiagnostics;
};

type SocialFormState = {
  query: string;
  entities: string;
  hashtags: string;
  tickers: string;
  usernames: string;
  user: string;
  tags: string;
  sort: "Top" | "Latest";
  limit: number;
};

const splitCsv = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const pickString = (row: SocialResult, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
};

const pickNumber = (row: SocialResult, keys: string[]): number | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

export default function SocialInvestigationPage() {
  const activeCaseIdHook = useActiveCaseId();
  const activeCaseId = activeCaseIdHook || getActiveCaseId();

  const [form, setForm] = useState<SocialFormState>({
    query: "",
    entities: "",
    hashtags: "",
    tickers: "",
    usernames: "",
    user: "",
    tags: "",
    sort: "Top",
    limit: 20,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [savedArtifacts, setSavedArtifacts] = useState<string[]>([]);

  const sourceTerms = useMemo(
    () => [
      ...splitCsv(form.entities),
      ...splitCsv(form.tags),
      ...splitCsv(form.hashtags).map((value) => (value.startsWith("#") ? value : `#${value}`)),
      ...splitCsv(form.tickers).map((value) => (value.startsWith("$") ? value : `$${value}`)),
      ...splitCsv(form.usernames).map((value) => (value.startsWith("@") ? value : `@${value}`)),
    ],
    [form]
  );

  const saveCaseEvent = async (payload: SearchResponse) => {
    if (!activeCaseId) {
      return;
    }

    const topResults = payload.results.slice(0, 8);
    const nodes = topResults.map((row, index) => {
      const handle = pickString(row, ["username", "handle", "screen_name", "author", "name"]) || `result_${index + 1}`;
      return {
        id: `social_${handle.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        label: handle,
        type: "social",
      };
    });

    const edges = nodes.map((node) => ({ source: node.id, target: "social_search_query", label: "matched" }));

    await fetch(`/api/cases/${activeCaseId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "social",
        title: `Social query returned ${payload.count} post(s)`,
        narrative: `Investigative query: ${payload.compiledQuery}`,
        metrics: {
          resultCount: payload.count,
          termCount: sourceTerms.length,
        },
        nodes: [{ id: "social_search_query", label: payload.compiledQuery || "query", type: "query" }, ...nodes],
        edges,
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  const saveArtifact = async (value: string, kind: "entity" | "hashtag" | "ticker" | "username" | "query") => {
    if (!activeCaseId || !value.trim()) {
      return;
    }

    await fetch(`/api/cases/${activeCaseId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value,
        kind,
        sourceFeature: "social",
        metadata: {
          query: response?.compiledQuery || form.query,
        },
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });

    setSavedArtifacts((current) => (current.includes(value) ? current : [...current, value]));
  };

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setSavedArtifacts([]);

    try {
      const payload = {
        query: form.query,
        entities: splitCsv(form.entities),
        hashtags: splitCsv(form.hashtags),
        tickers: splitCsv(form.tickers),
        usernames: splitCsv(form.usernames),
        user: form.user.trim(),
        tags: splitCsv(form.tags),
        sort: form.sort,
        limit: form.limit,
      };

      const res = await fetch("/api/social/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Search failed (${res.status})`);
      }

      const data = (await res.json()) as SearchResponse;
      setResponse(data);
      await saveCaseEvent(data);

      if (activeCaseId) {
        await Promise.all([
          ...splitCsv(form.entities).map((value) => saveArtifact(value, "entity")),
          ...splitCsv(form.tags).map((value) => saveArtifact(value, "entity")),
          ...splitCsv(form.hashtags).map((value) => saveArtifact(value.startsWith("#") ? value : `#${value}`, "hashtag")),
          ...splitCsv(form.tickers).map((value) => saveArtifact(value.startsWith("$") ? value : `$${value}`, "ticker")),
          ...splitCsv(form.usernames).map((value) => saveArtifact(value.startsWith("@") ? value : `@${value}`, "username")),
          ...(form.query.trim().length > 0 ? [saveArtifact(form.query.trim(), "query")] : []),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search social posts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 07</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Social Investigation</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Search X chatter by entity, tags, hashtags, ticker, and usernames. Save search intel as case-only artifacts.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          value={form.query}
          onChange={(e) => setForm((current) => ({ ...current, query: e.target.value }))}
          placeholder="Core query (free text)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          value={form.entities}
          onChange={(e) => setForm((current) => ({ ...current, entities: e.target.value }))}
          placeholder="Entities (comma-separated)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.tags}
          onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value }))}
          placeholder="Tags / aliases"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.hashtags}
          onChange={(e) => setForm((current) => ({ ...current, hashtags: e.target.value }))}
          placeholder="Hashtags (#optional)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.tickers}
          onChange={(e) => setForm((current) => ({ ...current, tickers: e.target.value }))}
          placeholder="Tickers ($optional)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.usernames}
          onChange={(e) => setForm((current) => ({ ...current, usernames: e.target.value }))}
          placeholder="Usernames (@optional)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.user}
          onChange={(e) => setForm((current) => ({ ...current, user: e.target.value }))}
          placeholder="Single user focus (@optional)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <select
          value={form.sort}
          onChange={(e) => setForm((current) => ({ ...current, sort: e.target.value as "Top" | "Latest" }))}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          <option value="Top">Sort: Top</option>
          <option value="Latest">Sort: Latest</option>
        </select>
        <input
          type="number"
          min={1}
          max={50}
          value={form.limit}
          onChange={(e) => setForm((current) => ({ ...current, limit: Number(e.target.value) || 20 }))}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={runSearch}
        disabled={loading}
        className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Searching..." : "Run Social Search"}
      </button>

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {response ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Compiled Query</p>
            <p className="mt-1 font-mono text-xs text-[var(--ink)]">{response.compiledQuery || "(empty)"}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Found {response.count} post(s)</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Sort mode: {form.sort}</p>
            {savedArtifacts.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">Saved {savedArtifacts.length} term(s) as case artifacts.</p>
            ) : null}
          </div>

          {response.diagnostics ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">deSearch Diagnostics</p>
              <p className="mt-2 text-xs text-[var(--muted)]">Strategy: {response.diagnostics.strategy}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Selected route: {response.diagnostics.selectedRoute ? `${response.diagnostics.selectedRoute.method} ${response.diagnostics.selectedRoute.path}` : "none"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Request attempts: {response.diagnostics.attempts.length}</p>
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2">
                {response.diagnostics.attempts.length > 0 ? (
                  response.diagnostics.attempts.map((attempt, index) => (
                    <p key={`${attempt.method}_${attempt.path}_${index}`} className="font-mono text-[11px] text-[var(--ink)]">
                      {attempt.method} {attempt.path} status={attempt.status ?? "n/a"}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">No request attempts recorded.</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Top Posts</p>
            <div className="mt-3 space-y-3">
              {response.results.slice(0, 30).map((row, index) => {
                const text = pickString(row, ["text", "content", "body", "message"]);
                const url = pickString(row, ["url", "link", "permalink"]);
                const handle = pickString(row, ["username", "handle", "screen_name", "author", "name"]);
                const createdAt = pickString(row, ["created_at", "createdAt", "timestamp", "time"]);
                const engagement = pickNumber(row, ["like_count", "retweet_count", "reply_count", "engagement", "engagementScore"]);

                return (
                  <article key={`${url || handle || "row"}_${index}`} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-[var(--ink)]">{handle || "unknown"}</p>
                      <p className="text-[11px] text-[var(--muted)]">{createdAt || ""}</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink)]">{text || "No text content"}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>Engagement: {typeof engagement === "number" ? engagement : "n/a"}</span>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-[var(--accent)]">
                          Open
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
