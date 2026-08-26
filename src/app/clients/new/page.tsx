import Link from "next/link";
import { ClientForm } from "@/components/ClientForm";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const user = await getCurrentUser();
  const users = await getStore().listUsers();
  const workers = users.filter((u) => u.role === "worker");
  const defaultWorkerId = user.role === "worker" ? user.id : workers[0]?.id ?? user.id;

  return (
    <div className="space-y-5">
      <header>
        <Link href="/clients" className="text-base font-bold text-brand-700 hover:underline">
          ← 대상자 관리
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          돌봄 대상자 등록
        </h1>
        <p className="mt-1 text-base text-ink-500">
          최소한의 정보만 수집합니다. 등록된 개인정보는 암호화되어 보관됩니다.
        </p>
      </header>
      <ClientForm workers={workers} defaultWorkerId={defaultWorkerId} />
    </div>
  );
}
