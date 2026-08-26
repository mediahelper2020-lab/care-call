import { buildTranscript } from "../ai/conversation";
import { heuristicAnalyze } from "../ai/heuristic";
import { daysAgoKst, fromKst, kstDateKey, kstDayOfWeek, startOfKstToday } from "../datetime";
import { maskName, normalizePhone, retentionUntil } from "../privacy";
import { URGENT_NOTICE } from "../labels";
import type {
  AuditLog,
  Call,
  Client,
  Intervention,
  Notification,
  Organization,
  RiskSignal,
  User,
} from "../types";

export interface SeedData {
  organizations: Organization[];
  users: User[];
  clients: Client[];
  calls: Call[];
  signals: RiskSignal[];
  interventions: Intervention[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}

/** 시드가 서버 재시작마다 동일하도록 결정적 난수를 쓴다. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const GIVEN = [
  "순자", "영수", "말순", "정희", "복순", "동식", "옥분", "만수", "금자", "재호",
  "춘자", "병철", "귀남", "상수", "명자", "태식", "숙자", "영근", "분이", "종수",
];
const GUARDIAN_GIVEN = ["지훈", "미영", "성호", "은주", "재원", "혜진", "동현", "수연"];
const GUARDIAN_RELATION = ["장남", "차녀", "장녀", "조카", "며느리"];

const WORKER_NAMES = ["이수현", "최민정", "김도윤", "박서연", "정하늘", "한지우"];

const NORMAL_REPLIES = [
  ["오늘 아침 잘 먹었어요.", "잠도 푹 잤어요.", "몸은 괜찮아요."],
  ["밥 잘 챙겨 먹었어요.", "약은 잘 챙겨 먹었어요.", "별일 없어요."],
  ["점심에 국수 해 먹었어요.", "잘 잤어요.", "아픈 데 없어요."],
  ["아침에 산책 다녀왔어요.", "밥 먹었어요.", "기분 좋아요."],
];

const ATTENTION_REPLIES = [
  ["입맛이 없어서 아침을 못 먹었어요.", "잠은 그럭저럭 잤어요.", "무릎이 좀 쑤셔요."],
  ["오늘은 밥 생각이 없네요.", "밤에 자다 깨서 뒤척였어요.", "괜찮아요."],
  ["약이 떨어졌는데 못 받아왔어요.", "밥은 먹었어요.", "허리가 좀 아파요."],
  ["요즘 혼자 있으니 외로워요.", "밥은 챙겨 먹었어요.", "밖에 못 나갔어요."],
];

export function buildSeed(now: Date = new Date()): SeedData {
  const random = mulberry32(20260826);
  const organization: Organization = { id: "org-001", name: "행복구 종합사회복지관" };

  const users: User[] = [
    { id: "user-admin", name: "관리자", role: "admin", organization_id: organization.id },
    ...WORKER_NAMES.map((name, index) => ({
      id: `user-w${index + 1}`,
      name,
      role: "worker" as const,
      organization_id: organization.id,
    })),
  ];
  const workers = users.filter((u) => u.role === "worker");

  const clients: Client[] = [];
  for (let i = 0; i < 124; i += 1) {
    const name = `${SURNAMES[i % SURNAMES.length]}${GIVEN[(i * 7) % GIVEN.length]}`;
    const worker = workers[i % workers.length];
    const guardianSurname = SURNAMES[(i + 3) % SURNAMES.length];
    const scheduleDays = i < 116 ? [1, 2, 3, 4, 5] : [2, 4];
    clients.push({
      id: `client-${String(i + 1).padStart(3, "0")}`,
      organization_id: organization.id,
      name,
      masked_name: maskName(name),
      birth_year: 1930 + Math.floor(random() * 20),
      phone: normalizePhone(`010${String(2000 + i).padStart(4, "0")}${String(1000 + i * 3).slice(-4)}`),
      guardian_name: `${guardianSurname}${GUARDIAN_GIVEN[i % GUARDIAN_GIVEN.length]}(${GUARDIAN_RELATION[i % GUARDIAN_RELATION.length]})`,
      guardian_phone: normalizePhone(`010${String(7000 + i).padStart(4, "0")}${String(2000 + i * 5).slice(-4)}`),
      assigned_worker: worker.id,
      call_schedule: { days: scheduleDays, time: "09:00" },
      consent_status: "granted",
      recording_consent: true,
      consent_updated_at: daysAgoKst(120 + (i % 30), now).toISOString(),
      note: "",
      created_at: daysAgoKst(200 - (i % 90), now).toISOString(),
      retention_until: retentionUntil(now),
    });
  }

  const calls: Call[] = [];
  const signals: RiskSignal[] = [];
  const notifications: Notification[] = [];
  let callSeq = 0;
  let signalSeq = 0;

  const record = (client: Client, at: Date, replies: string[], answered: boolean) => {
    callSeq += 1;
    const id = `call-${String(callSeq).padStart(5, "0")}`;
    if (!answered) {
      calls.push({
        id,
        client_id: client.id,
        started_at: at.toISOString(),
        ended_at: new Date(at.getTime() + 45_000).toISOString(),
        status: "no_answer",
        transcript: [],
        ai_summary: "전화 연결이 되지 않아 통화가 이루어지지 않았습니다.",
        risk_level: "normal",
        category_findings: [],
        decided_by: "none",
        ai_provider: "heuristic",
        acknowledged_by: null,
        acknowledged_at: null,
      });
      return calls[calls.length - 1];
    }

    const previous = calls
      .filter((c) => c.client_id === client.id && c.status === "completed")
      .slice(-3)
      .map((c) => c.ai_summary);
    const transcript = buildTranscript(client.name, replies, previous, at);
    const analysis = heuristicAnalyze(transcript, previous);
    const call: Call = {
      id,
      client_id: client.id,
      started_at: at.toISOString(),
      ended_at: new Date(at.getTime() + replies.length * 24_000 + 30_000).toISOString(),
      status: "completed",
      transcript,
      ai_summary: analysis.summary,
      risk_level: analysis.overall,
      category_findings: analysis.categories,
      decided_by: analysis.signals.length > 0 ? "rule" : "none",
      ai_provider: "heuristic",
      acknowledged_by: null,
      acknowledged_at: null,
    };
    calls.push(call);
    for (const signal of analysis.signals) {
      signalSeq += 1;
      signals.push({
        id: `signal-${String(signalSeq).padStart(5, "0")}`,
        call_id: call.id,
        client_id: client.id,
        category: signal.category,
        detected_text: signal.detected_text,
        risk_level: signal.risk_level,
        ai_reason: signal.ai_reason,
        source: "rule",
        created_at: at.toISOString(),
      });
    }
    return call;
  };

  // 최근 30일 이력. 추이 분석이 의미를 갖도록 대상자별로 며칠 간격을 둔다.
  for (let day = 30; day >= 1; day -= 1) {
    const dayStart = daysAgoKst(day, now);
    const weekday = kstDayOfWeek(dayStart);
    for (let i = 0; i < clients.length; i += 1) {
      const client = clients[i];
      if (!client.call_schedule.days.includes(weekday)) continue;
      if ((i + day) % 2 === 1) continue;

      const at = new Date(dayStart.getTime() + (9 * 60 + (i % 50) + 5) * 60_000);
      const answered = random() > 0.08;
      if (!answered) {
        record(client, at, [], false);
        continue;
      }
      // 대상자 0~3은 최근 7일 식사 관련 언급이 늘어나는 패턴을 갖는다.
      const risingMeal = i < 4 && day <= 7;
      const attention = risingMeal || random() < 0.12;
      const pool = attention ? ATTENTION_REPLIES : NORMAL_REPLIES;
      const replies = pool[Math.floor(random() * pool.length)];
      record(client, at, risingMeal ? ATTENTION_REPLIES[0] : replies, true);
    }
  }

  // 오늘의 통화. 대시보드 KPI가 명확히 드러나도록 구성한다.
  const todayStart = startOfKstToday(now);
  const todayAt = (index: number) =>
    new Date(todayStart.getTime() + (9 * 60 + Math.floor(index / 2)) * 60_000);

  const urgentReplies = [
    ["조금 전에 넘어져서 지금 도움이 필요해요.", "일어나기가 힘드네요.", "허리가 많이 아파요."],
    ["아침에 화장실에서 미끄러졌어요.", "다리가 아파서 못 움직이겠어요.", "밥도 못 먹었어요."],
  ];

  for (let i = 0; i < 116; i += 1) {
    const client = clients[i];
    const at = todayAt(i);
    if (i < 2) {
      const call = record(client, at, urgentReplies[i], true);
      notifications.push({
        id: `noti-${String(notifications.length + 1).padStart(4, "0")}`,
        client_id: client.id,
        call_id: call.id,
        worker_id: client.assigned_worker,
        risk_level: "urgent",
        title: `[AI 안심돌봄] ${client.masked_name} 대상자 긴급 확인 필요`,
        body: `${client.masked_name} 대상자의 오늘 안부전화에서 '${URGENT_NOTICE}' AI 분석 결과만으로 긴급상황을 확정하지 말고 대상자 상태를 직접 확인해 주세요.`,
        read_at: null,
        created_at: at.toISOString(),
      });
    } else if (i < 8) {
      const call = record(client, at, ATTENTION_REPLIES[i % ATTENTION_REPLIES.length], true);
      notifications.push({
        id: `noti-${String(notifications.length + 1).padStart(4, "0")}`,
        client_id: client.id,
        call_id: call.id,
        worker_id: client.assigned_worker,
        risk_level: "attention",
        title: `[AI 안심돌봄] ${client.masked_name} 대상자 확인 필요`,
        body: `${client.masked_name} 대상자의 오늘 안부전화에서 확인이 필요한 신호가 감지되었습니다. 담당자 확인을 부탁드립니다.`,
        read_at: null,
        created_at: at.toISOString(),
      });
    } else if (i < 98) {
      record(client, at, NORMAL_REPLIES[i % NORMAL_REPLIES.length], true);
    } else {
      record(client, at, [], false);
    }
  }

  const interventions: Intervention[] = [
    {
      id: "intv-0001",
      client_id: clients[8].id,
      call_id: null,
      worker_id: clients[8].assigned_worker,
      action: "call_client",
      note: "전화로 상태 확인함. 식사 정상적으로 하고 계심.",
      created_at: daysAgoKst(3, now).toISOString(),
    },
    {
      id: "intv-0002",
      client_id: clients[9].id,
      call_id: null,
      worker_id: clients[9].assigned_worker,
      action: "home_visit",
      note: "가정방문하여 생활환경 점검. 특이사항 없음.",
      created_at: daysAgoKst(10, now).toISOString(),
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: "audit-0001",
      actor_id: "user-admin",
      actor_name: "관리자",
      action: "system.seed",
      target: "system",
      detail: "시연용 초기 데이터를 생성했습니다.",
      created_at: now.toISOString(),
    },
  ];

  return {
    organizations: [organization],
    users,
    clients,
    calls,
    signals,
    interventions,
    notifications,
    auditLogs,
  };
}

/** 오늘 통화 일정을 만들 때 쓰는 기준 시각 */
export function scheduledTimeToday(time: string, now: Date = new Date()): Date {
  const [hour, minute] = time.split(":").map(Number);
  const [year, month, day] = kstDateKey(now).split("-").map(Number);
  return fromKst(year, month, day, hour, minute);
}
