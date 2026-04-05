"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AccessRequestStatus = "pending" | "code_generated" | "approved" | "rejected";

type AccessRequestRecord = {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  ecosystemRole: string;
  ecosystemRoleOther?: string;
  primaryUseCase: string;
  expectations: string;
  telegramOrDiscord?: string;
  websiteOrLinkedIn?: string;
  region?: string;
  xHandle?: string;
  status: AccessRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  generatedCode?: string;
  generatedCodeAt?: string;
  approvalEmailSentAt?: string;
  adminNotes?: string;
};

type QueueSummary = {
  total: number;
  reviewed: number;
  pending: number;
  codeGenerated: number;
  approved: number;
  rejected: number;
};

const statusStyles: Record<AccessRequestStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  code_generated: "border-blue-300 bg-blue-50 text-blue-800",
  approved: "border-emerald-300 bg-emerald-50 text-emerald-800",
  rejected: "border-red-300 bg-red-50 text-red-800",
};

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    reviewed: 0,
    pending: 0,
    codeGenerated: 0,
    approved: 0,
    rejected: 0,
  });
  const [status, setStatus] = useState<AccessRequestStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestRecord | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [acting, setActing] = useState<"generate_code" | "approve_send" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reviewedRatio = useMemo(() => `${summary.reviewed}/${summary.total}`, [summary.reviewed, summary.total]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ status });
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      params.set("_ts", String(Date.now()));
      const response = await fetch(`/api/admin/access-requests?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load access requests");
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setSummary({
        total: Number(data.summary?.total || 0),
        reviewed: Number(data.summary?.reviewed || 0),
        pending: Number(data.summary?.pending || 0),
        codeGenerated: Number(data.summary?.codeGenerated || 0),
        approved: Number(data.summary?.approved || 0),
        rejected: Number(data.summary?.rejected || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access requests");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, status]);

  const loadRequestDetail = useCallback(async (requestId: string) => {
    setReviewLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/access-requests/${requestId}?_ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load request details");
      }

      setSelectedId(requestId);
      setSelectedRequest(data.request || null);
      setAdminNotes(data.request?.adminNotes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request details");
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const runAction = async (action: "generate_code" | "approve_send" | "reject") => {
    if (!selectedId) {
      return;
    }

    if (action === "approve_send" && !selectedRequest?.generatedCode) {
      setError("Generate an access code before sending approval.");
      return;
    }

    setActing(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/access-requests/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNotes: adminNotes.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request action failed");
      }

      setSelectedRequest(data.request || null);
      setAdminNotes(data.request?.adminNotes || adminNotes);
      setMessage(data.message || "Action completed.");
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="dash-kicker">Admin Review</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Access Requests</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Review incoming access requests, generate one-time codes, then approve and send onboarding instructions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin" className="dash-frame-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
            Back to Admin
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="dash-frame p-4">
          <p className="dash-kicker">Reviewed</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ink)]">{reviewedRatio}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">x/y reviewed</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Pending</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ink)]">{summary.pending}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Code Generated</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ink)]">{summary.codeGenerated}</p>
        </div>
      </div>

      <section className="mt-6 dash-frame p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Queue</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Filter and open requests for detailed review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "pending", "code_generated", "approved", "rejected"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`border px-2 py-1 text-xs font-semibold ${status === option ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white" : "dash-frame-soft text-[var(--ink)]"}`}
              >
                {option === "all" ? "All" : option.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={applySearch} className="mt-4 flex flex-wrap gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email, role, or organization"
            className="dash-frame-soft min-w-[260px] flex-1 px-3 py-2 text-sm"
          />
          <button type="submit" className="dash-frame-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchTerm("");
            }}
            className="dash-frame-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
          >
            Clear
          </button>
        </form>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No requests found for the current filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border border-[var(--line)] text-left text-xs">
              <thead className="bg-[var(--panel)]">
                <tr>
                  <th className="border border-[var(--line)] px-2 py-2">Submitted</th>
                  <th className="border border-[var(--line)] px-2 py-2">Name</th>
                  <th className="border border-[var(--line)] px-2 py-2">Email</th>
                  <th className="border border-[var(--line)] px-2 py-2">Organization</th>
                  <th className="border border-[var(--line)] px-2 py-2">Status</th>
                  <th className="border border-[var(--line)] px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id} className="bg-[var(--paper)]">
                    <td className="border border-[var(--line)] px-2 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{item.fullName}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{item.email}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{item.organization}</td>
                    <td className="border border-[var(--line)] px-2 py-2">
                      <span className={`inline-flex border px-2 py-1 font-semibold ${statusStyles[item.status]}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="border border-[var(--line)] px-2 py-2">
                      <button
                        type="button"
                        onClick={() => void loadRequestDetail(item.id)}
                        className="border border-[var(--accent-strong)] bg-[var(--accent)] px-2 py-1 font-semibold text-white hover:bg-[var(--accent-strong)]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 dash-frame p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Review Detail</h2>
        {reviewLoading ? <p className="mt-3 text-sm text-[var(--muted)]">Loading detail...</p> : null}
        {!reviewLoading && !selectedRequest ? <p className="mt-3 text-sm text-[var(--muted)]">Select a request from the queue to review details.</p> : null}

        {selectedRequest ? (
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Applicant</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{selectedRequest.fullName}</p>
                <p className="text-sm text-[var(--muted)]">{selectedRequest.email}</p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Organization</p>
                <p className="mt-1 text-sm text-[var(--ink)]">{selectedRequest.organization}</p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Role in ecosystem</p>
                <p className="mt-1 text-sm text-[var(--ink)]">
                  {selectedRequest.ecosystemRole}
                  {selectedRequest.ecosystemRoleOther ? ` — ${selectedRequest.ecosystemRoleOther}` : ""}
                </p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Primary use case</p>
                <p className="mt-1 text-sm text-[var(--ink)]">{selectedRequest.primaryUseCase}</p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Expectations</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{selectedRequest.expectations}</p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Optional details</p>
                <p className="mt-1 text-sm text-[var(--ink)]">Telegram/Discord: {selectedRequest.telegramOrDiscord || "-"}</p>
                <p className="text-sm text-[var(--ink)]">Website/LinkedIn: {selectedRequest.websiteOrLinkedIn || "-"}</p>
                <p className="text-sm text-[var(--ink)]">Region: {selectedRequest.region || "-"}</p>
                <p className="text-sm text-[var(--ink)]">X/Twitter: {selectedRequest.xHandle || "-"}</p>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
                <span className={`mt-2 inline-flex border px-2 py-1 text-xs font-semibold ${statusStyles[selectedRequest.status]}`}>
                  {selectedRequest.status.replace("_", " ")}
                </span>
                <p className="mt-2 text-xs text-[var(--muted)]">Submitted: {new Date(selectedRequest.createdAt).toLocaleString()}</p>
                <p className="text-xs text-[var(--muted)]">Reviewed: {selectedRequest.reviewedAt ? new Date(selectedRequest.reviewedAt).toLocaleString() : "-"}</p>
              </div>

              <div className="dash-frame-soft p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Generated code</p>
                <p className="mt-1 font-mono text-sm text-[var(--ink)]">{selectedRequest.generatedCode || "Not generated"}</p>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Admin notes</span>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={5}
                  className="dash-frame-soft mt-1 w-full px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => void runAction("generate_code")}
                  disabled={acting !== null || selectedRequest.status === "approved" || selectedRequest.status === "rejected"}
                  className="border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                >
                  {acting === "generate_code" ? "Generating..." : "Generate Code"}
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("approve_send")}
                  disabled={acting !== null || !selectedRequest.generatedCode || selectedRequest.status === "approved" || selectedRequest.status === "rejected"}
                  className="border border-emerald-500 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {acting === "approve_send" ? "Sending..." : "Approve & Send Email"}
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("reject")}
                  disabled={acting !== null || selectedRequest.status === "approved" || selectedRequest.status === "rejected"}
                  className="border border-red-400 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {acting === "reject" ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {message ? <p className="mt-4 border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </section>
    </div>
  );
}
