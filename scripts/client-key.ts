/**
 * Make a key that lets a client's own dashboard read their conversations
 * through /api/embed/conversations.
 *
 *   npm run client-key -- "Selene Ashé" "Bootyverse admin"
 *
 * Prints the key once. Only its hash is stored.
 */
import { createClientKey, listClients } from "../lib/db/queries";

async function main() {
  const [name, label = ""] = process.argv.slice(2);
  const client = (await listClients()).find((c) => c.name === name);
  if (!client) throw new Error(`No client named "${name}"`);
  console.log(await createClientKey(client.id, label));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
