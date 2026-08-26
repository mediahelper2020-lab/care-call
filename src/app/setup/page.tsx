import Link from "next/link";
import { SetupScreen } from "@/components/SetupScreen";
import { getSetupStatus } from "@/lib/store/supabase-setup";
import { supabaseCredentials } from "@/lib/store/supabase";

export const dynamic = "force-dynamic";
// 초기 데이터 저장은 여러 번의 삽입 요청으로 이루어지므로 기본 실행시간보다 여유를 둔다.
export const maxDuration = 60;

export default async function SetupPage() {
  if (!supabaseCredentials()) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">최초 설정</h1>
        <p className="rounded-lg border border-watch-500/40 bg-watch-50 px-4 py-3 text-base font-semibold text-watch-700">
          지금은 메모리 저장소로 동작 중입니다. 화면은 모두 사용할 수 있지만, 서버가 다시 시작되면
          입력한 내용이 사라집니다.
        </p>
        <p className="text-base text-ink-600">
          데이터를 계속 보관하려면 Supabase 연결 정보(NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY)를 환경변수로 설정한 뒤 이 화면을 다시 열어 주세요.
        </p>
        <Link href="/" className="btn-secondary">
          대시보드로 이동
        </Link>
      </div>
    );
  }

  const status = await getSetupStatus();
  return <SetupScreen status={status} />;
}
