import fs from "node:fs";
import path from "node:path";

// One small interface over two databases:
//   Postgres (Supabase, Neon, any Postgres), when DATABASE_URL starts with postgres://
//   SQLite through libSQL otherwise: a local file by default, or Turso
// Queries are written once, with ? placeholders, in SQL both understand.

export type Row = Record<string, unknown>;
export type Args = (string | number | null)[];

export interface Database {
  query(sql: string, args?: Args): Promise<Row[]>;
  /** Several writes that succeed or fail together */
  batch(statements: { sql: string; args?: Args }[]): Promise<void>;
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '',
    guardrails TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT '',
    voice_id TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    extra_languages TEXT NOT NULL DEFAULT '[]',
    llm TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'interview',
    audience TEXT NOT NULL DEFAULT 'client',
    title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT '',
    opening TEXT NOT NULL DEFAULT '',
    topics TEXT NOT NULL DEFAULT '[]',
    closing TEXT NOT NULL DEFAULT '',
    checklist TEXT NOT NULL DEFAULT '[]',
    report TEXT NOT NULL DEFAULT '',
    estimated_minutes INTEGER NOT NULL DEFAULT 20,
    archived INTEGER NOT NULL DEFAULT 0,
    elevenlabs_agent_id TEXT,
    synced_hash TEXT,
    synced_at TEXT,
    report_markdown TEXT,
    report_generated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    call_number INTEGER NOT NULL DEFAULT 1,
    session_key TEXT NOT NULL,
    brief TEXT NOT NULL,
    conversation_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    topics TEXT NOT NULL DEFAULT '[]',
    checklist TEXT NOT NULL DEFAULT '[]',
    current_topic_id TEXT,
    closing_summary TEXT,
    transcript TEXT NOT NULL DEFAULT '[]',
    extracted TEXT NOT NULL DEFAULT '{}',
    call_summary TEXT,
    duration_seconds INTEGER,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    synced_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_id TEXT,
    type TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    urgency TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'new',
    response TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS agents_client ON agents(client_id)`,
  `CREATE INDEX IF NOT EXISTS interviews_agent ON interviews(agent_id)`,
  `CREATE INDEX IF NOT EXISTS links_interview ON links(interview_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_interview ON sessions(interview_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS sessions_conversation ON sessions(conversation_id)`,
  `CREATE INDEX IF NOT EXISTS requests_client ON requests(client_id, created_at)`,
];

/**
 * Columns added after a table first shipped. CREATE TABLE IF NOT EXISTS won't
 * add them to an existing database, so each runs on startup; "already exists"
 * errors mean it's done.
 */
const ADDED_COLUMNS = [["interviews", "audience TEXT NOT NULL DEFAULT 'client'"]];

const TABLES = ["clients", "agents", "interviews", "links", "sessions", "requests", "settings"];

/**
 * Hosts like Supabase expose the public schema over a REST API. Row level
 * security with no policies closes that door: only the server's own database
 * connection (which owns the tables) can read or write them.
 */
export const POSTGRES_ONLY = TABLES.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);

/** ? placeholders become $1, $2... for Postgres. None of our SQL has a literal "?". */
const numbered = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

async function postgres(url: string): Promise<Database> {
  const { default: connect } = await import("postgres");
  // prepare: false works with transaction poolers (Supabase on :6543, PgBouncer, Neon pooled URLs)
  const sql = connect(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
  return {
    query: async (text, args = []) => [...(await sql.unsafe(numbered(text), args))] as Row[],
    batch: async (statements) => {
      await sql.begin(async (tx) => {
        for (const s of statements) await tx.unsafe(numbered(s.sql), s.args ?? []);
      });
    },
  };
}

async function sqlite(url: string, authToken?: string): Promise<Database> {
  const { createClient } = await import("@libsql/client");
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");
  return {
    query: async (sql, args = []) => (await client.execute({ sql, args })).rows as unknown as Row[],
    batch: async (statements) => {
      await client.batch(
        statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
        "write",
      );
    },
  };
}

let ready: Promise<Database> | null = null;

async function connect(): Promise<Database> {
  // Vercel's Turso integration sets TURSO_*
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:data/voice.db";
  const isPostgres = /^postgres(ql)?:\/\//.test(url);
  const database = isPostgres
    ? await postgres(url)
    : await sqlite(url, process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined);
  await database.batch([...SCHEMA, ...(isPostgres ? POSTGRES_ONLY : [])].map((sql) => ({ sql })));
  for (const [table, column] of ADDED_COLUMNS) {
    try {
      await database.query(`ALTER TABLE ${table} ADD COLUMN ${isPostgres ? "IF NOT EXISTS " : ""}${column}`);
    } catch (err) {
      if (!/duplicate column|already exists/i.test(String(err))) throw err;
    }
  }
  return database;
}

/** The database, with the schema applied on first use. */
export function db(): Promise<Database> {
  if (!ready) {
    ready = connect().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
