"use client";

import { useEffect, useState } from "react";
import { FeedbackRecord, FeedbackStatus, FeedbackType, FeedbackQueueSummary } from "@/lib/azure";

interface FeedbackListResult {
  success: boolean;
  type: string | null;
  status: string;
  search: string;
  summary: FeedbackQueueSummary;
  feedback: FeedbackRecord[];
}

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([]);
  const [summary, setSummary] = useState<FeedbackQueueSummary>({
    total: 0,
    new: 0,
    inReview: 0,
    resolved: 0,
    dismissed: 0,
  });
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const statusStyles: Record<FeedbackStatus, string> = {
    new: "border-amber-300 bg-amber-50 text-amber-800",
    in_review: "border-blue-300 bg-blue-50 text-blue-800",
    resolved: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dismissed: "border-red-300 bg-red-50 text-red-800",
  };

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch feedback");

      const data: FeedbackListResult = await response.json();
      setFeedbackList(data.feedback);
      setSummary(data.summary);
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [typeFilter, statusFilter, searchTerm]);

  const handleStatusUpdate = async (feedbackId: string, newStatus: FeedbackStatus) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      const data = await response.json();
      const updated = data.feedback as FeedbackRecord;

      setFeedbackList((prev) =>
        prev.map((f) => (f.id === feedbackId ? updated : f))
      );

      setSelectedId(null);
      fetchFeedback();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdating(false);
    }
  };

  const selectedFeedback = feedbackList.find((f) => f.id === selectedId);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--ink)]">Feedback</h1>
        <p className="text-sm text-[var(--muted)]">Review and manage user feedback</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] px-6 py-4 sm:grid-cols-5">
        <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
          <p className="text-xs font-medium text-[var(--muted)]">Total</p>
          <p className="text-lg font-semibold text-[var(--ink)]">{summary.total}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700">New</p>
          <p className="text-lg font-semibold text-amber-800">{summary.new}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700">In Review</p>
          <p className="text-lg font-semibold text-blue-800">{summary.inReview}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-700">Resolved</p>
          <p className="text-lg font-semibold text-emerald-800">{summary.resolved}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">Dismissed</p>
          <p className="text-lg font-semibold text-red-800">{summary.dismissed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--ink)]">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "all")}
              className="mt-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <option value="all">All Types</option>
              <option value="feature_request">Feature Requests</option>
              <option value="bug_report">Bug Reports</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink)]">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
              className="mt-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--ink)]">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or description..."
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
          </div>
        </div>
      </div>

      {/* List and Detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Feedback List */}
        <div className="w-full overflow-y-auto border-r border-[var(--border)] sm:w-1/2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-[var(--muted)]">Loading feedback...</p>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-[var(--muted)]">No feedback found</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {feedbackList.map((feedback) => (
                <button
                  key={feedback.id}
                  onClick={() => setSelectedId(feedback.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-[var(--bg-secondary)] ${
                    selectedId === feedback.id ? "bg-[var(--bg-secondary)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block rounded text-xs font-semibold" style={{ color: feedback.type === "feature_request" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)" }}>
                          {feedback.type === "feature_request" ? "✨" : "🐛"} {feedback.type === "feature_request" ? "Feature" : "Bug"}
                        </span>
                      </div>
                      <p className="truncate font-medium text-[var(--ink)]">{feedback.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{feedback.email}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{new Date(feedback.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[feedback.status]}`}>
                      {feedback.status.replace("_", " ")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail View */}
        <div className="hidden w-1/2 flex-col overflow-y-auto p-6 sm:flex">
          {selectedFeedback ? (
            <>
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--ink)]">
                      {selectedFeedback.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{selectedFeedback.email}</p>
                  </div>
                  <div className={`rounded-lg border px-3 py-1 text-sm font-medium ${statusStyles[selectedFeedback.status]}`}>
                    {selectedFeedback.status.replace("_", " ")}
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">Type</p>
                    <p className="text-sm text-[var(--ink)]">
                      {selectedFeedback.type === "feature_request" ? "Feature Request" : "Bug Report"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">Category</p>
                    <p className="text-sm text-[var(--ink)]">{selectedFeedback.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">Date</p>
                    <p className="text-sm text-[var(--ink)]">
                      {new Date(selectedFeedback.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-[var(--bg-secondary)] p-4">
                  <p className="mb-2 text-xs font-medium text-[var(--muted)]">Description</p>
                  <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                    {selectedFeedback.description}
                  </p>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="mt-auto border-t border-[var(--border)] pt-4">
                <p className="mb-3 text-xs font-medium text-[var(--muted)]">Update Status</p>
                <div className="flex flex-col gap-2">
                  {(["new", "in_review", "resolved", "dismissed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedFeedback.id, status)}
                      disabled={selectedFeedback.status === status || updating}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        selectedFeedback.status === status
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      } disabled:opacity-50`}
                    >
                      Mark as {status.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center">
              <p className="text-sm text-[var(--muted)]">Select feedback to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
