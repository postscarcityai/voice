/**
 * Load a client, their agents and interviews from a JSON file.
 *
 *   npm run seed -- clients/acme.json
 *
 * Shape (see examples/client.example.json):
 *   { "client": {...}, "agents": [{ ..., "interviews": [{...}, ...] }] }
 *
 * Long text can live in files next to the JSON: "contextFile", "guardrailsFile"
 * on the client; "roleFile", "methodFile", "reportFile" on an interview.
 *
 * Re-running updates in place: the client is matched by name, agents by name,
 * interviews by title. Calls, links and requests are kept. Every interview
 * gets a share link if it has none, and all links are printed.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createAgent,
  createClient,
  createInterview,
  createLink,
  listAgents,
  listClients,
  listInterviews,
  listLinks,
  updateAgent,
  updateClient,
  updateInterview,
} from "../lib/db/queries";
import { parseAgentInput, parseClientInput, parseInterviewInput } from "../lib/validate";

type Json = Record<string, unknown>;

function withFiles(obj: Json, dir: string, fields: string[]): Json {
  const out = { ...obj };
  for (const field of fields) {
    const file = obj[`${field}File`];
    if (typeof file === "string") {
      const text = fs.readFileSync(path.join(dir, file), "utf8").trim();
      out[field] = [obj[field], text].filter(Boolean).join("\n\n");
    }
  }
  return out;
}

function must<T>(r: { input?: T; error?: string }, what: string): T {
  if (!r.input) throw new Error(`${what}: ${r.error}`);
  return r.input;
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: npm run seed -- <client.json>");
    process.exit(1);
  }
  const dir = path.dirname(file);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { client: Json; agents?: Json[] };
  const base = process.env.PUBLIC_URL?.replace(/\/$/, "") || "http://localhost:3030";

  const clientInput = must(parseClientInput(withFiles(raw.client, dir, ["context", "guardrails"])), "client");
  const existingClient = (await listClients()).find((c) => c.name === clientInput.name);
  const client = existingClient ? (await updateClient(existingClient.id, clientInput))! : await createClient(clientInput);
  console.log(`${existingClient ? "Updated" : "Created"} client ${client.name}${client.company ? ` (${client.company})` : ""}`);

  for (const rawAgent of raw.agents ?? []) {
    const agentInput = must(parseAgentInput(rawAgent), "agent");
    const existingAgent = (await listAgents(client.id)).find((a) => a.name === agentInput.name);
    const agent = existingAgent ? (await updateAgent(existingAgent.id, agentInput))! : await createAgent(client.id, agentInput);
    console.log(`  ${existingAgent ? "Updated" : "Created"} agent ${agent.name}`);

    for (const rawInterview of (rawAgent.interviews as Json[] | undefined) ?? []) {
      const input = must(parseInterviewInput(withFiles(rawInterview, dir, ["role", "method", "report"])), "interview");
      const existing = (await listInterviews(agent.id)).find((i) => i.title === input.title);
      const interview = existing ? (await updateInterview(existing.id, input))! : await createInterview(agent.id, input);
      let links = await listLinks(interview.id);
      const label = interview.audience === "team" ? client.owner || "Team" : client.name;
      if (!links.length) links = [await createLink(interview.id, label)];
      const what = interview.kind === "open_line" ? "open line" : `${interview.topics.length} topics, ~${interview.estimatedMinutes} min`;
      console.log(`    ${existing ? "Updated" : "Created"} "${interview.title}" (${what})`);
      for (const l of links.filter((x) => !x.revoked)) console.log(`      ${base}/s/${l.token}`);
    }
  }
  console.log("\nAgents are pushed to ElevenLabs when you save them in the admin, or when the first call starts.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
