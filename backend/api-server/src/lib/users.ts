import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Identity } from "./identity";
import { dataDir } from "./paths";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  lastLoginAt: string;
}

const usersFile = path.join(dataDir, "users.json");
let cache: User[] | null = null;

function load(): User[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(usersFile, "utf8")) as User[];
  } catch {
    cache = [];
  }
  return cache;
}

function save(users: User[]): void {
  mkdirSync(dataDir, { recursive: true });
  const tmp = `${usersFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(users, null, 2));
  renameSync(tmp, usersFile);
  cache = users;
}

export function findUserById(id: string): User | undefined {
  return load().find((u) => u.id === id);
}

export function findUserByIdentity(identity: Identity): User | undefined {
  return load().find((u) =>
    identity.channel === "email" ? u.email === identity.value : u.phone === identity.value,
  );
}

function defaultName(identity: Identity): string {
  if (identity.channel === "email") return identity.value.split("@")[0] || "Weather Now user";
  return `User ${identity.value.slice(-4)}`;
}

/** Finds the account for this email/phone, or creates it on first sign-in. */
export function signInUser(identity: Identity, name?: string): User {
  const users = [...load()];
  const now = new Date().toISOString();
  const existing = users.find((u) =>
    identity.channel === "email" ? u.email === identity.value : u.phone === identity.value,
  );

  if (existing) {
    const updated: User = { ...existing, lastLoginAt: now };
    save(users.map((u) => (u.id === existing.id ? updated : u)));
    return updated;
  }

  const created: User = {
    id: randomUUID(),
    name: name?.trim() || defaultName(identity),
    ...(identity.channel === "email" ? { email: identity.value } : { phone: identity.value }),
    createdAt: now,
    lastLoginAt: now,
  };
  save([...users, created]);
  return created;
}

/** What the browser is allowed to see about a user. */
export function publicUser(user: User): Pick<User, "id" | "name" | "email" | "phone"> {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}
