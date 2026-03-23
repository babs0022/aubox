"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { useEffect, useMemo, useState } from "react";

type CaseArtifact = {
  id: string;
  tag: string;
  value: string;
  kind: "address" | "entity" | "hashtag" | "ticker" | "username" | "query" | "note";
  sourceFeature: "trace" | "cluster" | "social" | "profile" | "timeline" | "report" | "manual";
  aliases?: string[];
  updatedAt: string;
};

const KIND_OPTIONS: Array<CaseArtifact["kind"]> = ["note", "address", "entity", "hashtag", "ticker", "username", "query"];

const formatWhen = (iso: string): string => {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function ArtifactManagerPage() {
  const activeCaseIdHook = useActiveCaseId();
  const activeCaseId = activeCaseIdHook || getActiveCaseId();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<CaseArtifact[]>([]);

  const [newValue, setNewValue] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newKind, setNewKind] = useState<CaseArtifact["kind"]>("note");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadArtifacts = async (searchValue = query) => {
    if (!activeCaseId) {
      setArtifacts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${activeCaseId}/artifacts?q=${encodeURIComponent(searchValue)}&limit=120`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load artifacts (${response.status})`);
      }

      const body = (await response.json()) as { artifacts?: CaseArtifact[] };
      setArtifacts(Array.isArray(body.artifacts) ? body.artifacts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts");
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtifacts("").catch(() => {
      // handled in loadArtifacts
    });
  }, [activeCaseId]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const artifact of artifacts) {
      counts[artifact.kind] = (counts[artifact.kind] || 0) + 1;
    }
    return counts;
  }, [artifacts]);

  const createManualArtifact = async () => {
    if (!activeCaseId || !newValue.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${activeCaseId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: newValue.trim(),
          tag: newTag.trim() || undefined,
          kind: newKind,
          sourceFeature: "manual",
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Failed to save artifact (${response.status})`);
      }

      setNewValue("");
      setNewTag("");
      await loadArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save artifact");
    } finally {
      setSaving(false);
    }
  };

  const renameArtifact = async (artifactId: string) => {
    if (!activeCaseId || !editingTag.trim()) {
      return;
    }

    setRenamingId(artifactId);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${activeCaseId}/artifacts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artifactId, tag: editingTag.trim() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Failed to rename (${response.status})`);
      }

      setEditingId(null);
      setEditingTag("");
      await loadArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename artifact");
    } finally {
      setRenamingId(null);
    }
  };

  const removeArtifact = async (artifactId: string) => {
    if (!activeCaseId) {
      return;
    }

    setDeletingId(artifactId);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${activeCaseId}/artifacts?id=${encodeURIComponent(artifactId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Failed to delete (${response.status})`);
      }

      setArtifacts((current) => current.filter((item) => item.id !== artifactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete artifact");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 08</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Artifact Manager</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Review, search, rename, and delete case-only investigation artifacts.</p>

      {!activeCaseId ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Open a case to manage artifacts.
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Add Manual Artifact</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder="Value"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            placeholder="Tag (optional)"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <select
            value={newKind}
            onChange={(event) => setNewKind(event.target.value as CaseArtifact["kind"])}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={!activeCaseId || saving || !newValue.trim()}
          onClick={createManualArtifact}
          className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Artifact"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by tag/value/alias"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <button
          disabled={!activeCaseId || loading}
          onClick={() => loadArtifacts()}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)] disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
        <button
          disabled={!activeCaseId || loading}
          onClick={() => {
            setQuery("");
            loadArtifacts("").catch(() => {
              // handled in loadArtifacts
            });
          }}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)] disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs text-[var(--muted)]">Total Artifacts</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{artifacts.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 sm:col-span-2">
          <p className="text-xs text-[var(--muted)]">Kinds</p>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {Object.keys(kindCounts).length > 0
              ? Object.entries(kindCounts)
                  .map(([kind, count]) => `${kind}:${count}`)
                  .join(" | ")
              : "No artifacts yet"}
          </p>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Artifacts</p>
        <div className="mt-3 space-y-3">
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{artifact.tag}</p>
                  <p className="text-xs text-[var(--muted)]">{artifact.kind} from {artifact.sourceFeature}</p>
                </div>
                <p className="text-[11px] text-[var(--muted)]">{formatWhen(artifact.updatedAt)}</p>
              </div>

              <p className="mt-2 break-all font-mono text-xs text-[var(--ink)]">{artifact.value}</p>

              {artifact.aliases && artifact.aliases.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--muted)]">Aliases: {artifact.aliases.join(", ")}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {editingId === artifact.id ? (
                  <>
                    <input
                      value={editingTag}
                      onChange={(event) => setEditingTag(event.target.value)}
                      className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs"
                    />
                    <button
                      disabled={renamingId === artifact.id || !editingTag.trim()}
                      onClick={() => renameArtifact(artifact.id)}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                    >
                      {renamingId === artifact.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingTag("");
                      }}
                      className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(artifact.id);
                        setEditingTag(artifact.tag);
                      }}
                      className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                    >
                      Rename Tag
                    </button>
                    <button
                      disabled={deletingId === artifact.id}
                      onClick={() => removeArtifact(artifact.id)}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingId === artifact.id ? "Deleting..." : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}

          {!loading && artifacts.length === 0 ? <p className="text-sm text-[var(--muted)]">No artifacts found for this case.</p> : null}
        </div>
      </div>
    </div>
  );
}
