import Link from "next/link";
import { switchUserAction } from "@/app/actions";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/clients", label: "대상자 관리" },
  { href: "/notifications", label: "알림" },
  { href: "/privacy", label: "개인정보 보호" },
];

export function AppShell({
  user,
  users,
  unreadCount,
  temporaryStorage,
  children,
}: {
  user: User;
  users: User[];
  unreadCount: number;
  /** 메모리 저장소로 동작 중이면 입력한 내용이 유지되지 않는다는 것을 알린다. */
  temporaryStorage: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-ink-900 text-white lg:min-h-screen lg:w-64 lg:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/" className="block">
            <p className="text-xl font-extrabold tracking-tight">AI 안심돌봄</p>
            <p className="mt-0.5 text-sm text-ink-300">돌봄 모니터링 시스템</p>
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-2 lg:flex-col lg:gap-0.5 lg:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold text-ink-100 hover:bg-white/10"
            >
              {item.label}
              {item.href === "/notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-alert-500 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="text-xs font-semibold text-ink-400">로그인 계정</p>
          <p className="mt-1 text-base font-bold">{user.name}</p>
          <p className="text-sm text-ink-300">
            {user.role === "admin" ? "관리자" : "사회복지사"}
          </p>
          <form action={switchUserAction} className="mt-3">
            <label htmlFor="user-switch" className="sr-only">
              계정 전환
            </label>
            <select
              id="user-switch"
              name="userId"
              defaultValue={user.id}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="text-ink-800">
                  {u.name} ({u.role === "admin" ? "관리자" : "사회복지사"})
                </option>
              ))}
            </select>
            <button type="submit" className="mt-2 w-full rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">
              계정 전환
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          {temporaryStorage ? (
            <p className="mb-5 rounded-lg border border-watch-500/40 bg-watch-50 px-4 py-3 text-base font-semibold text-watch-700">
              임시 저장소로 동작 중입니다. 서버가 다시 시작되면 입력한 내용이 사라집니다.{" "}
              <Link href="/setup" className="underline">
                데이터 보관 설정하기
              </Link>
            </p>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
