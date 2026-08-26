import { cookies } from "next/headers";
import { getStore } from "./store";
import type { Client, User } from "./types";

const SESSION_COOKIE = "care_session_user";
const DEFAULT_USER_ID = "user-admin";

/**
 * MVP 인증. Supabase Auth를 붙이기 전까지 쿠키에 담긴 사용자 ID로 동작한다.
 * 권한 판정 로직은 실제 인증으로 바꿔도 그대로 쓸 수 있도록 여기에 모아둔다.
 */
export async function getCurrentUser(): Promise<User> {
  const store = getStore();
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value ?? DEFAULT_USER_ID;
  const user = (await store.getUser(id)) ?? (await store.getUser(DEFAULT_USER_ID));
  // 계정 정보가 아직 없는 초기 상태에서도 화면이 열리도록 기본 관리자로 되돌린다.
  return user ?? { id: DEFAULT_USER_ID, name: "관리자", role: "admin", organization_id: "org-001" };
}

export async function setCurrentUserCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/** 관리자는 전체를, 사회복지사는 담당 대상자만 볼 수 있다. */
export function canAccessClient(user: User, client: Client): boolean {
  if (user.role === "admin") return true;
  return client.assigned_worker === user.id;
}

/** 통화 원문은 관리자와 담당 사회복지사에게만 공개한다. */
export function canViewTranscript(user: User, client: Client): boolean {
  return canAccessClient(user, client);
}

export function assertAccess(user: User, client: Client): void {
  if (!canAccessClient(user, client)) {
    throw new Error("해당 대상자에 대한 접근 권한이 없습니다.");
  }
}

/** 목록·상세에서 사용자가 볼 수 있는 대상자만 남긴다. */
export function visibleClients(user: User, clients: Client[]): Client[] {
  if (user.role === "admin") return clients;
  return clients.filter((c) => c.assigned_worker === user.id);
}
