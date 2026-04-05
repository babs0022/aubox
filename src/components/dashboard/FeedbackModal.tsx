"use client";

import { useState } from "react";
import { FeedbackType } from "@/lib/azure";

interface FeedbackModalProps {
  open: boolean;
  type?: FeedbackType;
  onClose: () => void;
}

export function FeedbackModal({ open, type: initialType, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>(initialType || "feature_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const featureCategories = ["UI", "Infrastructure", "Integration", "Other"];
  const bugCategories = ["UI", "Performance", "Data", "Other"];
  const categories = type === "feature_request" ? featureCategories : bugCategories;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType(initialType || "feature_request");
    setTitle("");
    setDescription("");
    setCategory("");
    setError("");
    setSuccess(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-[var(--ink)]">
          {type === "feature_request" ? "Request a Feature" : "Report a Bug"}
        </h2>

        {success && (
          <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ Thank you! Your feedback has been submitted.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            {/* Type Selector */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">Type</label>
              <div className="flex gap-3">
                <label className="flex items-center cursor-pointer gap-2">
                  <input
                    type="radio"
                    value="feature_request"
                    checked={type === "feature_request"}
                    onChange={(e) => {
                      setType(e.target.value as FeedbackType);
                      setCategory("");
                    }}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm text-[var(--ink)]">Feature Request</span>
                </label>
                <label className="flex items-center cursor-pointer gap-2">
                  <input
                    type="radio"
                    value="bug_report"
                    checked={type === "bug_report"}
                    onChange={(e) => {
                      setType(e.target.value as FeedbackType);
                      setCategory("");
                    }}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm text-[var(--ink)]">Bug Report</span>
                </label>
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                Title
                <span className="text-xs text-[var(--muted)]"> ({title.length}/100)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="Brief summary of your feedback"
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                Description
                <span className="text-xs text-[var(--muted)]"> ({description.length}/2000)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder={type === "feature_request" 
                  ? "Describe what you'd like to see..." 
                  : "Describe the issue you encountered..."}
                className="min-h-[100px] w-full resize-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>

            {/* Category */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--bg-secondary)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !description.trim() || !category || loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
