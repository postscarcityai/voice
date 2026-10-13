import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// SQLite through libSQL. Locally that is a file in data/; in production point
// DATABASE_URL at a Turso database (libsql://...) or any libSQL server, so the
// app runs on serverless hosts like Vercel as well as on a box with a disk.

const SCHEMA = [
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

let client: Client | null = null;
let ready: Promise<void> | null = null;

function connect(): Client {
  // TURSO_* are the names the Vercel Turso integration sets
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:data/voice.db";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  return createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
  });
}

/** The database client, with the schema applied on first use. */
export async function db(): Promise<Client> {
  if (!client) client = connect();
  if (!ready) {
    const c = client;
    ready = (async () => {
      await c.execute("PRAGMA foreign_keys = ON");
      await c.batch(SCHEMA, "write");
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  return client;
}
