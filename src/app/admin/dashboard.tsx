"use client";

import { useState } from "react";
import { suspendUser, unsuspendUser, reviewViolation, reviewAppeal, reviewReport, removeWarning, resetWarnings, applyContentWarning, removeContentWarning, searchPostsForWarning } from "./actions";
import { PremiumTab, type PremiumUser, type PremiumCompRecord } from "./premium-tab";

type Tab = "reports" | "violations" | "appeals" | "users" | "warnings" | "premium" | "log";

interface ReportRecord {
  id: string;
  contentType: string;
  contentId: string;
  category: string;
  description: string;
  status: string;
  reviewedAt: Date | null;
  createdAt: Date;
  reporter: { username: string | null };
  reviewer: { username: string | null } | null;
}

interface Violation {
  id: string;
  type: string;
  confidence: number;
  action: string;
  reviewedAt: Date | null;
  createdAt: Date;
  user: { id: string; username: string | null; avatar: string | null; contentWarnings: number; suspended: boolean };
  post: { id: string; content: string | null };
}

interface AppealRecord {
  id: string;
  type: string;
  reason: string;
  status: string;
  response: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  user: { id: string; username: string | null; avatar: string | null; suspended: boolean };
  reviewer: { username: string | null } | null;
}

interface FlaggedUser {
  id: string;
  username: string | null;
  avatar: string | null;
  email: string | null;
  contentWarnings: number;
  suspended: boolean;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  createdAt: Date;
}

interface ModerationActionRecord {
  id: string;
  action: string;
  reason: string | null;
  createdAt: Date;
  admin: { username: string | null };
  user: { username: string | null };
}

export function AdminDashboard({
  reports,
  violations,
  appeals,
  flaggedUsers,
  recentActions,
  premiumUsers,
  recentComps,
}: {
  reports: ReportRecord[];
  violations: Violation[];
  appeals: AppealRecord[];
  flaggedUsers: FlaggedUser[];
  recentActions: ModerationActionRecord[];
  premiumUsers: PremiumUser[];
  recentComps: PremiumCompRecord[];
}) {
  const [tab, setTab] = useState<Tab>("reports");
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const pendingAppeals = appeals.filter((a) => a.status === "pending").length;
  const pendingViolations = violations.filter((v) => v.action === "pending_review").length;

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {([
          ["reports", `Reports${pendingReports ? ` (${pendingReports})` : ""}`],
          ["violations", `Violations${pendingViolations ? ` (${pendingViolations})` : ""}`],
          ["appeals", `Appeals${pendingAppeals ? ` (${pendingAppeals})` : ""}`],
          ["users", "Users"],
          ["warnings", "Content Warnings"],
          ["premium", "Premium"],
          ["log", "Action Log"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reports" && <ReportsTab reports={reports} />}
      {tab === "violations" && <ViolationsTab violations={violations} />}
      {tab === "appeals" && <AppealsTab appeals={appeals} />}
      {tab === "users" && <UsersTab users={flaggedUsers} />}
      {tab === "warnings" && <ContentWarningsTab />}
      {tab === "premium" && <PremiumTab users={premiumUsers} comps={recentComps} />}
      {tab === "log" && <ActionLogTab actions={recentActions} />}
    </div>
  );
}

function ReportsTab({ reports }: { reports: ReportRecord[] }) {
  const categoryColors: Record<string, string> = {
    harassment: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    hate_speech: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    spam: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    csam: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    self_harm: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    violence: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    nudity_unmarked: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    impersonation: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    privacy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {reports.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No reports submitted.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {reports.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${categoryColors[r.category] || categoryColors.other}`}>
                      {r.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-400">{r.contentType}</span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                      r.status === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : r.status === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    Reported by <span className="font-medium">@{r.reporter.username}</span>
                    {" — "}{r.description.slice(0, 120)}{r.description.length > 120 ? "…" : ""}
                  </p>
                  {r.reviewer && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Reviewed by @{r.reviewer.username}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                {r.status === "pending" && (
                  <form action={reviewReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="status" value="reviewed" />
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Mark Reviewed
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViolationsTab({ violations }: { violations: Violation[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {violations.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No violations recorded.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {violations.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      v.type === "hate_speech" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : v.type === "bullying" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {v.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-400">{(v.confidence * 100).toFixed(0)}% confidence</span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                      v.action === "pending_review" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : v.action === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {v.action.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <a href={`/${v.user.username}`} className="font-medium hover:underline">@{v.user.username}</a>
                    {" — "}
                    <a href={`/post/${v.post.id}`} className="text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                      {v.post.content?.slice(0, 80) || "View post"}
                    </a>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                {v.action === "pending_review" && (
                  <form action={reviewViolation}>
                    <input type="hidden" name="violationId" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Mark Reviewed
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppealsTab({ appeals }: { appeals: AppealRecord[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {appeals.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No appeals submitted.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {appeals.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {a.type.replace(/_/g, " ")}
                    </span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      a.status === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : a.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <a href={`/${a.user.username}`} className="font-medium hover:underline">@{a.user.username}</a>
                    {" — "}{a.reason}
                  </p>
                  {a.response && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Response: {a.response}
                      {a.reviewer?.username && ` (by @${a.reviewer.username})`}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
                {a.status === "pending" && <AppealActions appealId={a.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppealActions({ appealId }: { appealId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [action, setAction] = useState<"approved" | "denied" | null>(null);

  if (!showForm) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => { setAction("approved"); setShowForm(true); }}
          className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
        >
          Approve
        </button>
        <button
          onClick={() => { setAction("denied"); setShowForm(true); }}
          className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          Deny
        </button>
      </div>
    );
  }

  return (
    <form action={reviewAppeal} className="flex flex-col gap-2">
      <input type="hidden" name="appealId" value={appealId} />
      <input type="hidden" name="status" value={action!} />
      <textarea
        name="response"
        placeholder="Response to user (optional)"
        rows={2}
        className="w-48 rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
            action === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          Confirm {action === "approved" ? "Approve" : "Deny"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function UsersTab({ users }: { users: FlaggedUser[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {users.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No flagged users.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRow({ user }: { user: FlaggedUser }) {
  const [showSuspendForm, setShowSuspendForm] = useState(false);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <a href={`/${user.username}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                @{user.username}
              </a>
              {user.suspended && (
                <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  suspended
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {user.contentWarnings} warning{user.contentWarnings !== 1 ? "s" : ""}
              {user.suspensionReason && ` — ${user.suspensionReason}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.contentWarnings > 0 && (
            <>
              <form action={removeWarning}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                >
                  −1 Warning
                </button>
              </form>
              {user.contentWarnings > 1 && (
                <form action={resetWarnings}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                  >
                    Reset All
                  </button>
                </form>
              )}
            </>
          )}
          {user.suspended ? (
            <form action={unsuspendUser}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
              >
                Unsuspend
              </button>
            </form>
          ) : (
            <>
              {!showSuspendForm ? (
                <button
                  onClick={() => setShowSuspendForm(true)}
                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                  Suspend
                </button>
              ) : (
                <form action={suspendUser} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    name="reason"
                    placeholder="Reason"
                    className="w-40 rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuspendForm(false)}
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

interface SearchedPost {
  id: string;
  content: string | null;
  isNsfw: boolean;
  isGraphicNudity: boolean;
  isSensitive: boolean;
  createdAt: Date;
  author: { id: string; username: string | null; avatar: string | null } | null;
}

function ContentWarningsTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedPost[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const posts = await searchPostsForWarning(query);
      setResults(posts);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const warningTypes = [
    { key: "isNsfw", label: "NSFW", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
    { key: "isGraphicNudity", label: "Explicit / Graphic", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    { key: "isSensitive", label: "Sensitive", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Search for a post by ID or content to apply or remove content warnings.
        </p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Post ID or search text..."
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {searched && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No posts found.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((post) => (
                <li key={post.id} className="px-4 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {post.author?.avatar ? (
                          <img src={post.author.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        )}
                        <a href={`/${post.author?.username}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                          @{post.author?.username}
                        </a>
                        <span className="text-xs text-zinc-400">{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {post.content?.slice(0, 200)}{(post.content?.length ?? 0) > 200 ? "..." : ""}
                      </p>
                      <a href={`/post/${post.id}`} className="mt-0.5 inline-block text-xs text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                        View post
                      </a>
                    </div>
                  </div>

                  {/* Current flags */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {warningTypes.map((wt) => {
                      const isSet = post[wt.key as keyof SearchedPost] === true;
                      return (
                        <span
                          key={wt.key}
                          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                            isSet ? wt.color : "bg-zinc-50 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}
                        >
                          {isSet ? "✓ " : ""}{wt.label}
                        </span>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {warningTypes.map((wt) => {
                      const isSet = post[wt.key as keyof SearchedPost] === true;
                      return (
                        <form key={wt.key} action={isSet ? removeContentWarning : applyContentWarning}>
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="warningType" value={wt.key} />
                          <button
                            type="submit"
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              isSet
                                ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            }`}
                          >
                            {isSet ? `Remove ${wt.label}` : `Apply ${wt.label}`}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ActionLogTab({ actions }: { actions: ModerationActionRecord[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {actions.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No actions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {actions.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">@{a.admin.username}</span>
                {" "}
                <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                  a.action === "suspend" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : a.action === "unsuspend" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {a.action}
                </span>
                {" "}
                <span className="font-medium">@{a.user.username}</span>
              </p>
              {a.reason && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{a.reason}</p>}
              <p className="mt-0.5 text-xs text-zinc-400">{new Date(a.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
