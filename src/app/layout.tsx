import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 안심돌봄 | 돌봄 모니터링 시스템",
  description: "AI 안부전화로 돌봄 대상자의 상태를 확인하고 위험 신호를 담당자에게 전달합니다.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const store = getStore();
  const [users, notifications] = await Promise.all([
    store.listUsers(),
    store.listNotifications({ unreadOnly: true }),
  ]);
  const unread =
    user.role === "admin"
      ? notifications.length
      : notifications.filter((n) => n.worker_id === user.id).length;

  return (
    <html lang="ko">
      <body>
        <AppShell user={user} users={users} unreadCount={unread}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
