import { get, put } from "@vercel/blob";

export type JournalLevel = "info" | "warn" | "error";
export type JournalSource = "pi" | "serveur";

export interface JournalEntry {
  /** Horodatage en millisecondes, posé par la source de l'événement. */
  at: number;
  level: JournalLevel;
  source: JournalSource;
  message: string;
}

/**
 * Le journal est un tampon circulaire : il sert à comprendre ce qui vient de
 * se passer, pas à archiver. Le plafond borne la taille du blob, qui est
 * réécrit en entier à chaque ajout.
 */
const MAX_ENTRIES = 120;
const MAX_MESSAGE = 300;
const JOURNAL_PATH = "state/journal.json";

const LEVELS: JournalLevel[] = ["info", "warn", "error"];
const SOURCES: JournalSource[] = ["pi", "serveur"];

export function sanitizeEntry(value: unknown): JournalEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message.trim() : "";

  if (!message) {
    return null;
  }

  const at =
    typeof obj.at === "number" && Number.isFinite(obj.at) && obj.at > 0
      ? obj.at
      : Date.now();

  return {
    at,
    level: LEVELS.includes(obj.level as JournalLevel)
      ? (obj.level as JournalLevel)
      : "info",
    source: SOURCES.includes(obj.source as JournalSource)
      ? (obj.source as JournalSource)
      : "pi",
    message: message.slice(0, MAX_MESSAGE),
  };
}

export async function getJournal(): Promise<JournalEntry[]> {
  try {
    const result = await get(JOURNAL_PATH, { access: "public" });

    if (!result) {
      return [];
    }

    const parsed: unknown = JSON.parse(
      await new Response(result.stream).text(),
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeEntry)
      .filter((entry): entry is JournalEntry => entry !== null);
  } catch {
    return [];
  }
}

/**
 * Ajoute des entrées au journal, les plus récentes en tête.
 *
 * Volontairement sans verrou : deux écritures simultanées peuvent perdre une
 * ligne, ce qui est acceptable pour un journal de diagnostic et bien moins
 * coûteux qu'un mécanisme de coordination.
 */
export async function appendJournal(
  entries: readonly (JournalEntry | null)[],
): Promise<void> {
  const clean = entries.filter((e): e is JournalEntry => e !== null);

  if (clean.length === 0) {
    return;
  }

  const existing = await getJournal();
  const merged = [...clean, ...existing]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ENTRIES);

  await put(JOURNAL_PATH, JSON.stringify(merged), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Raccourci pour les événements produits par le serveur lui-même. */
export async function logServer(
  level: JournalLevel,
  message: string,
): Promise<void> {
  await appendJournal([
    { at: Date.now(), level, source: "serveur", message },
  ]);
}
