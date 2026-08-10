import postgres from "postgres";

export type UtmVisit = {
  source: string;
  medium: string;
  campaign: string;
  count: number;
};

type VisitCountRow = {
  source: string;
  medium: string;
  campaign: string;
  count: number;
};

let sqlClient: ReturnType<typeof postgres> | null = null;
let tableReady: Promise<void> | null = null;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 1,
      prepare: false,
    });
  }

  return sqlClient;
}

async function ensureTable() {
  if (!tableReady) {
    const sql = getSql();

    tableReady = sql`
      create table if not exists utm_visits (
        id bigserial primary key,
        source text not null,
        medium text not null,
        campaign text not null,
        created_at timestamptz not null default now()
      )
    `
      .then(
        () => sql`
          alter table utm_visits
          add column if not exists medium text not null default 'unknown'
        `,
      )
      .then(() => undefined);
  }

  return tableReady;
}

export async function recordUtmVisit(
  source: string,
  medium: string,
  campaign: string,
) {
  const sql = getSql();

  await ensureTable();

  await sql`
    insert into utm_visits (source, medium, campaign)
    values (${source}, ${medium}, ${campaign})
  `;

  const [row] = await sql<[{ count: number }]>`
    select count(*)::int as count
    from utm_visits
    where source = ${source}
      and medium = ${medium}
      and campaign = ${campaign}
  `;

  return row?.count ?? 0;
}

export async function listUtmVisits() {
  const sql = getSql();

  await ensureTable();

  const rows = await sql<VisitCountRow[]>`
    select
      source,
      medium,
      campaign,
      count(*)::int as count
    from utm_visits
    group by source, medium, campaign
    order by count desc, source asc, medium asc, campaign asc
  `;

  return rows.map((row) => ({
    campaign: row.campaign,
    count: row.count,
    medium: row.medium,
    source: row.source,
  }));
}
