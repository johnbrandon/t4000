// Read-only import of iCloud contacts over CardDAV.
//
// iCloud has no contacts OAuth and its CardDAV endpoint sends no CORS headers,
// so the browser can't talk to it directly — the import runs here on the server
// using an Apple ID + app-specific password (never the account password). We
// only ever read: we fetch vCards and mirror them into our `contacts` table;
// we never write back to iCloud.
//
// Credentials come from env (set them on the Railway service, not the client):
//   ICLOUD_USERNAME      = the Apple ID, e.g. you@icloud.com
//   ICLOUD_APP_PASSWORD  = an app-specific password from appleid.apple.com
import { createDAVClient } from "tsdav";
import { pruneICloudContactsNotIn, upsertICloudContact, type ContactImport } from "./db";

const USERNAME = process.env.ICLOUD_USERNAME;
const APP_PASSWORD = process.env.ICLOUD_APP_PASSWORD;
const ICLOUD_CARDDAV_URL = "https://contacts.icloud.com";

export function icloudConfigured(): boolean {
  return Boolean(USERNAME && APP_PASSWORD);
}

// --- minimal vCard 3.0 reader (FN/N, EMAIL, TEL, ADR, ORG, UID) ---

interface ParsedCard {
  uid: string | null;
  fullName: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  organization: string | null;
}

// Undo the text escaping vCard applies to values (\n \, \; \\).
function unescapeValue(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// Join RFC 6350 folded lines: a continuation starts with a space or tab.
function unfold(raw: string): string[] {
  const physical = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const logical: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

// Split a logical line into { name, params, value }. Property names may carry a
// group prefix ("item1.EMAIL") and params ("TEL;type=CELL:..."); the value is
// everything after the first unescaped colon.
function parseLine(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  let name = head.split(";")[0];
  const dot = name.indexOf(".");
  if (dot >= 0) name = name.slice(dot + 1); // strip "item1." group prefix
  return { name: name.toUpperCase().trim(), value };
}

// ADR value is 7 semicolon-separated components (po box; extended; street;
// locality; region; postal; country). Render the non-empty ones on one line.
function formatAddress(value: string): string {
  const parts = value.split(";").map((p) => unescapeValue(p)).filter(Boolean);
  return parts.join(", ");
}

function parseVCard(data: string): ParsedCard | null {
  if (!data || !/BEGIN:VCARD/i.test(data)) return null;
  const card: ParsedCard = { uid: null, fullName: "", emails: [], phones: [], addresses: [], organization: null };
  let structuredName = "";
  for (const line of unfold(data)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, value } = parsed;
    switch (name) {
      case "UID":
        card.uid = unescapeValue(value) || null;
        break;
      case "FN":
        card.fullName = unescapeValue(value);
        break;
      case "N": {
        // "Family;Given;Additional;Prefix;Suffix" -> "Given Family"
        const [family = "", given = ""] = value.split(";").map(unescapeValue);
        structuredName = [given, family].filter(Boolean).join(" ");
        break;
      }
      case "EMAIL": {
        const email = unescapeValue(value);
        if (email && !card.emails.includes(email)) card.emails.push(email);
        break;
      }
      case "TEL": {
        const tel = unescapeValue(value);
        if (tel && !card.phones.includes(tel)) card.phones.push(tel);
        break;
      }
      case "ADR": {
        const addr = formatAddress(value);
        if (addr && !card.addresses.includes(addr)) card.addresses.push(addr);
        break;
      }
      case "ORG":
        // ORG is semicolon-separated org units; keep the leading org name.
        card.organization = unescapeValue(value.split(";")[0]) || null;
        break;
    }
  }
  if (!card.fullName) card.fullName = structuredName || card.emails[0] || "(no name)";
  return card;
}

// tsdav versions differ on where the vCard text lands; accept the common keys.
function cardText(v: Record<string, unknown>): string {
  return String(v.data ?? v.addressData ?? v.vcard ?? "");
}

export interface SyncResult {
  imported: number;
  pruned: number;
  addressBooks: number;
}

function reason(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function syncContacts(): Promise<SyncResult> {
  if (!icloudConfigured()) {
    throw new Error("iCloud is not configured on the server");
  }

  // createDAVClient authenticates and discovers the CardDAV principal/home-set,
  // so a bad Apple ID or app-specific password surfaces here.
  let client: Awaited<ReturnType<typeof createDAVClient>>;
  try {
    client = await createDAVClient({
      serverUrl: ICLOUD_CARDDAV_URL,
      credentials: { username: USERNAME as string, password: APP_PASSWORD as string },
      authMethod: "Basic",
      defaultAccountType: "carddav",
    });
  } catch (err) {
    throw new Error(
      `could not sign in to iCloud as "${USERNAME}" — check the Apple ID and app-specific password (${reason(err)})`
    );
  }

  let addressBooks: Awaited<ReturnType<typeof client.fetchAddressBooks>>;
  try {
    addressBooks = await client.fetchAddressBooks();
  } catch (err) {
    throw new Error(`signed in, but could not read iCloud address books (${reason(err)})`);
  }
  const keepUids: string[] = [];
  let imported = 0;

  for (const addressBook of addressBooks) {
    // iCloud rejects the addressbook-query REPORT that fetchVCards uses by default
    // (it answers 507 Insufficient Storage). So enumerate the card URLs with a
    // PROPFIND (Depth 1), which iCloud accepts, then fetch their data by URL with
    // multiget — passing objectUrls makes fetchVCards skip the failing query.
    let cardUrls: string[];
    try {
      const entries = await client.propfind({
        url: addressBook.url,
        props: { "d:getetag": {} },
        depth: "1",
      });
      cardUrls = entries.map((e) => e.href ?? "").filter((href) => Boolean(href));
    } catch (err) {
      throw new Error(`could not list cards in address book (${reason(err)})`);
    }

    // Fetch in batches so a large address book can't produce an oversized request.
    const BATCH = 100;
    const vcards: Array<Record<string, unknown>> = [];
    for (let i = 0; i < cardUrls.length; i += BATCH) {
      const batch = await client.fetchVCards({
        addressBook,
        objectUrls: cardUrls.slice(i, i + BATCH),
      });
      vcards.push(...(batch as Array<Record<string, unknown>>));
    }

    for (const v of vcards) {
      const card = parseVCard(cardText(v));
      if (!card || !card.uid) continue;
      const input: ContactImport = {
        icloudUid: card.uid,
        fullName: card.fullName,
        emails: card.emails,
        phones: card.phones,
        addresses: card.addresses,
        organization: card.organization,
        source: "icloud",
      };
      await upsertICloudContact(input);
      keepUids.push(card.uid);
      imported++;
    }
  }

  // Only prune when we actually read at least one address book, so a transient
  // discovery failure can't wipe the mirror.
  const pruned = addressBooks.length > 0 ? await pruneICloudContactsNotIn(keepUids) : 0;
  return { imported, pruned, addressBooks: addressBooks.length };
}

// Exported for local unit testing of the parser without network access.
export const __test = { parseVCard, unfold, formatAddress };
