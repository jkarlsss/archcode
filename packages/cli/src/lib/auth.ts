import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type AuthData = {
  token: string;
};

const AUTH_DIR = join(homedir(), ".archcode");
const AUTH_FILE = join(AUTH_DIR, "auth.json");

/**
 * Reads and parses the local authentication token securely.
 */
export async function getAuth(): Promise<AuthData | null> {
  try {
    // FIX: Using non-blocking promise-based file reads
    const data = await readFile(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<AuthData>;

    return typeof parsed.token === "string" ? { token: parsed.token } : null;
  } catch {
    return null;
  }
}

/**
 * Persists the authentication token to disk with restricted permissions.
 */
export async function saveAuth(data: AuthData): Promise<void> {
  if (!existsSync(AUTH_DIR)) {
    // FIX: Awaiting promise-based folder creation
    await mkdir(AUTH_DIR, { mode: 0o700, recursive: true });
  }

  // FIX: Awaiting promise-based file writing
  await writeFile(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}

/**
 * Completely removes the authentication file from the local machine.
 */
export async function clearAuth(): Promise<void> {
  try {
    await unlink(AUTH_FILE);  
  } catch {
    // Fail silently if the file already does not exist
  } 
}

/**
 * Generates valid authorization headers for outbound API requests.
 * Wrap this inside your API Client or fetch wrapper configuration.
 */
export async function getRequestHeaders(): Promise<Headers> {
  // FIX: Properly await the asynchronous file token check
  const auth = await getAuth();
  const headers = new Headers();

  // FIX: Maintain type consistency by only returning a standard Headers object
  if (auth?.token) {
    headers.set("Authorization", `Bearer ${auth.token}`);
  }

  return headers;
}