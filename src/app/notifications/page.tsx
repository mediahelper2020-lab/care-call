import Link from "next/link";
import { markNotificationReadAction } from "@/app/actions";
import { RiskBadge } from "@/components/RiskBadge";
import { getCurrentUser } from "@/lib/auth";
import { kstDateTimeLabel } from "@/lib/datetime";
import { RISK_ORDER } from "@/lib/labels";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const store = getStore();
  const notifications = await store.listNotifications(
    user.role === "admin" ? {} : { workerId: user.id },
  );

  const unread = notifications
    .filter((n) => !n.read_at)
    .sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level]);
  const read = notifications.filter((n) => n.read_at);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">알림</h1>
        <p className="mt-1 text-base text-ink-500">
          위험 신호가 감지되면 담당 사회복지사에게 알림이 전달됩니다. 확인하지 않은 알림 {unread.length}건.
        </p>
      </header>

      <section className="space-y-3">
        {unread.length === 0 ? (
          <p className="card px-5 py-8 text-center text-base text-ink-500">
            확인하지 않은 알림이 없습니다.
          </p>
        ) : null}

        {unread.map((notification) => (
          <article
            key={notification.id}
            className={`card border-l-4 p-5 ${
              notification.risk_level === "urgent" ? "border-l-alert-500" : "border-l-watch-500"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge status={notification.risk_level} size="sm" />
              <h2 className="text-base font-extrabold text-ink-900">{notification.title}</h2>
              <span className="ml-auto text-sm text-ink-500">
                {kstDateTimeLabel(notification.created_at)}
              </span>
            </div>
            <p className="mt-2 text-base leading-relaxed text-ink-700">{notification.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/clients/${notification.client_id}`} className="btn-primary">
                대상자 확인하기
              </Link>
              <form action={markNotificationReadAction}>
                <input type="hidden" name="notificationId" value={notification.id} />
                <button type="submit" className="btn-secondary">
                  읽음 처리
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>

      {read.length > 0 ? (
        <section>
          <h2 className="text-lg font-extrabold text-ink-900">확인한 알림</h2>
          <ul className="card mt-3 divide-y divide-ink-100">
            {read.slice(0, 20).map((notification) => (
              <li key={notification.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <RiskBadge status={notification.risk_level} size="sm" />
                <Link
                  href={`/clients/${notification.client_id}`}
                  className="text-base font-semibold text-brand-700 hover:underline"
                >
                  {notification.title}
                </Link>
                <span className="ml-auto text-sm text-ink-500">
                  {kstDateTimeLabel(notification.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
