"use client";

import { useEffect, useMemo, useState } from "react";

type UtmParams = {
  campaign: string;
  medium: string;
  source: string;
};

type UtmVisit = UtmParams & {
  count: number;
};

type TrackingStatus =
  | "checking"
  | "recorded"
  | "missing"
  | "already-recorded"
  | "failed";

type StatsResponse = {
  visits: UtmVisit[];
};

const EMPTY_UTM: UtmParams = {
  campaign: "",
  medium: "",
  source: "",
};

const STATUS_TEXT: Record<TrackingStatus, string> = {
  "already-recorded": "이 브라우저에서는 이미 집계된 링크입니다.",
  checking: "유입 정보를 확인하는 중입니다.",
  failed: "집계 요청에 실패했습니다.",
  missing: "URL에 utm_source, utm_medium, utm_campaign이 없습니다.",
  recorded: "유입이 집계되었습니다.",
};

function readUtmFromLocation(): UtmParams {
  const params = new URLSearchParams(window.location.search);

  return {
    campaign: params.get("utm_campaign")?.trim() ?? "",
    medium: params.get("utm_medium")?.trim() ?? "",
    source: params.get("utm_source")?.trim() ?? "",
  };
}

function hasRequiredUtm(utm: UtmParams) {
  return Boolean(utm.source && utm.medium && utm.campaign);
}

function getVisitStorageKey(utm: UtmParams) {
  return `utm-visit:${utm.source}:${utm.medium}:${utm.campaign}`;
}

async function requestStats() {
  const response = await fetch("/api/utm", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load stats.");
  }

  return response.json() as Promise<StatsResponse>;
}

async function recordVisit(utm: UtmParams) {
  const response = await fetch("/api/utm", {
    body: JSON.stringify(utm),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to record visit.");
  }

  return response.json() as Promise<StatsResponse>;
}

function useUtmTracking() {
  const [currentUtm, setCurrentUtm] = useState<UtmParams>(EMPTY_UTM);
  const [status, setStatus] = useState<TrackingStatus>("checking");
  const [visits, setVisits] = useState<UtmVisit[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function syncStats(nextStatus: TrackingStatus) {
      const stats = await requestStats();

      if (!cancelled) {
        setStatus(nextStatus);
        setVisits(stats.visits);
      }
    }

    async function trackVisit() {
      try {
        const utm = readUtmFromLocation();
        setCurrentUtm(utm);

        if (!hasRequiredUtm(utm)) {
          await syncStats("missing");
          return;
        }

        const visitKey = getVisitStorageKey(utm);

        if (window.localStorage.getItem(visitKey) === "1") {
          await syncStats("already-recorded");
          return;
        }

        const stats = await recordVisit(utm);
        window.localStorage.setItem(visitKey, "1");

        if (!cancelled) {
          setStatus("recorded");
          setVisits(stats.visits);
        }
      } catch {
        if (!cancelled) {
          setStatus("failed");
        }
      }
    }

    trackVisit();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    currentUtm,
    status,
    visits,
  };
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value || "-"}</p>
    </div>
  );
}

function VisitsTable({ visits }: { visits: UtmVisit[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-medium">utm_source</th>
            <th className="px-5 py-3 font-medium">utm_medium</th>
            <th className="px-5 py-3 font-medium">utm_campaign</th>
            <th className="px-5 py-3 text-right font-medium">유입 수</th>
          </tr>
        </thead>
        <tbody>
          {visits.length > 0 ? (
            visits.map((visit) => (
              <tr
                className="border-t border-zinc-100"
                key={`${visit.source}:${visit.medium}:${visit.campaign}`}
              >
                <td className="max-w-[220px] break-words px-5 py-4 font-medium">
                  {visit.source}
                </td>
                <td className="max-w-[220px] break-words px-5 py-4">
                  {visit.medium}
                </td>
                <td className="max-w-[220px] break-words px-5 py-4">
                  {visit.campaign}
                </td>
                <td className="px-5 py-4 text-right font-semibold">
                  {visit.count}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-5 py-8 text-center text-zinc-500" colSpan={4}>
                아직 집계된 유입이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function UtmDashboard() {
  const { currentUtm, status, visits } = useUtmTracking();
  const totalVisits = useMemo(
    () => visits.reduce((total, visit) => total + visit.count, 0),
    [visits],
  );

  return (
    <main className="flex min-h-screen w-full bg-stone-50 text-zinc-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-teal-700">Linking UTM Test</p>
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            링크 유입 집계
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="전체 유입" value={totalVisits} />
          <SummaryCard label="현재 source" value={currentUtm.source} />
          <SummaryCard label="현재 medium" value={currentUtm.medium} />
          <SummaryCard label="현재 campaign" value={currentUtm.campaign} />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold">집계 결과</h2>
            <p className="mt-1 text-sm text-zinc-500">{STATUS_TEXT[status]}</p>
          </div>

          <VisitsTable visits={visits} />
        </div>
      </section>
    </main>
  );
}
