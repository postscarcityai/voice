import { createClient, listClients } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";
import { parseClientInput } from "@/lib/validate";

export async function GET() {
  return json({ clients: await listClients() });
}

export async function POST(request: Request) {
  const { input, error } = parseClientInput(await readJson(request));
  if (!input) return fail(error!);
  return json({ client: await createClient(input) }, 201);
}
