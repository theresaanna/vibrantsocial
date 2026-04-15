import { prisma } from "@/lib/prisma";
import { AdminDashboard } from "./dashboard";

export default async function AdminPage() {
  const [
    reports,
    violations,
    appeals,
    flaggedUsers,
    recentActions,
    premiumUsers,
    recentComps,
  ] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        reporter: { select: { username: true } },
        reviewer: { select: { username: true } },
      },
    }),
    prisma.contentViolation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, username: true, avatar: true, contentWarnings: true, suspended: true } },
        post: { select: { id: true, content: true } },
      },
    }),
    prisma.appeal.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, username: true, avatar: true, suspended: true } },
        reviewer: { select: { username: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { contentWarnings: { gt: 0 } },
          { suspended: true },
        ],
      },
      orderBy: { contentWarnings: "desc" },
      take: 50,
      select: {
        id: true,
        username: true,
        avatar: true,
        email: true,
        contentWarnings: true,
        suspended: true,
        suspendedAt: true,
        suspensionReason: true,
        createdAt: true,
      },
    }),
    prisma.moderationAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        admin: { select: { username: true } },
        user: { select: { username: true } },
      },
    }),
    prisma.user.findMany({
      where: { tier: "premium" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        premiumExpiresAt: true,
        createdAt: true,
      },
      take: 200,
    }),
    prisma.premiumComp.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        admin: { select: { username: true } },
        user: { select: { username: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Moderation Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Review reports, violations, manage users, and handle appeals
          </p>
        </div>
      </div>
      <AdminDashboard
        reports={reports}
        violations={violations}
        appeals={appeals}
        flaggedUsers={flaggedUsers}
        recentActions={recentActions}
        premiumUsers={premiumUsers}
        recentComps={recentComps}
      />
    </main>
  );
}
