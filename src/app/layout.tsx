import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SetupScreen } from "@/components/SetupScreen";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { pendingSetup } from "@/lib/store/readiness";
import { supabaseCredentials } from "@/lib/store/supabase";
import type { User } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 안심돌봄 | 돌봄 모니터링 시스템",
  description: "AI 안부전화로 돌봄 대상자의 상태를 확인하고 위험 신호를 담당자에게 전달합니다.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 배포 직후처럼 아직 데이터베이스가 준비되지 않았으면 오류 대신 설정 화면을 보여준다.
  const setup = await pendingSetup();
  if (setup) {
    return (
      <html lang="ko">
        <body>
          <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
            <SetupScreen status={setup} />
          </div>
        </body>
      </html>
    );
  }

  const user = await getCurrentUser();
  const store = getStore();
  const [users, notifications] = await Promise.all([store.listUsers(), store.listNotifications({ unreadOnly: true })]);
  const unread =
    user.role === "admin"
      ? notifications.length
      : notifications.filter((n) => n.worker_id === user.id).length;

  return (
    <html lang="ko">
      <body>
        <AppShell
          user={user}
          users={users as User[]}
          unreadCount={unread}
          temporaryStorage={!supabaseCredentials()}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
