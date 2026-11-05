import type { Adapter } from "next-auth/adapters";
import { randomUUID } from "node:crypto";
import { db } from "@/prisma/db";

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new TypeError(`OAuth account field "${field}" must be a string`);
  }
  return value;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`OAuth account field "${field}" must be an integer`);
  }
  return value;
}

export function PrismaOrmAdapter(): Adapter {
  return {
    async createUser(user) {
      return db.orm.public.User.create({
        id: user.id ?? randomUUID(),
        name: user.name ?? null,
        email: user.email,
        emailVerified: user.emailVerified ?? null,
        image: user.image ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    },

    async getUser(id) {
      return db.orm.public.User.first({ id });
    },

    async getUserByEmail(email) {
      return db.orm.public.User.first({ email });
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await db.orm.public.Account.first({
        provider,
        providerAccountId,
      });
      return account ? db.orm.public.User.first({ id: account.userId }) : null;
    },

    async updateUser(user) {
      const changes: {
        name?: string | null;
        email?: string;
        emailVerified?: Date | null;
        image?: string | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (user.name !== undefined) changes.name = user.name;
      if (user.email !== undefined) changes.email = user.email;
      if (user.emailVerified !== undefined) {
        changes.emailVerified = user.emailVerified;
      }
      if (user.image !== undefined) changes.image = user.image;

      const updatedUser = await db.orm.public.User.where({
        id: user.id,
      }).update(changes);
      if (!updatedUser) {
        throw new Error(`Cannot update missing auth user "${user.id}"`);
      }
      return updatedUser;
    },

    async deleteUser(id) {
      const user = await db.orm.public.User.first({ id });
      if (!user) return null;

      await db.orm.public.User.where({ id }).delete();
      return user;
    },

    async linkAccount(account) {
      await db.orm.public.Account.create({
        id: randomUUID(),
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: nullableString(account.refresh_token, "refresh_token"),
        access_token: nullableString(account.access_token, "access_token"),
        expires_at: nullableNumber(account.expires_at, "expires_at"),
        token_type: nullableString(account.token_type, "token_type"),
        scope: nullableString(account.scope, "scope"),
        id_token: nullableString(account.id_token, "id_token"),
        session_state: nullableString(account.session_state, "session_state"),
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const account = await db.orm.public.Account.first({
        provider,
        providerAccountId,
      });
      if (account) {
        await db.orm.public.Account.where({ id: account.id }).delete();
      }
    },

    async createSession(session) {
      return db.orm.public.Session.create(session);
    },

    async getSessionAndUser(sessionToken) {
      const session = await db.orm.public.Session.first({ sessionToken });
      if (!session) return null;

      const user = await db.orm.public.User.first({ id: session.userId });
      return user ? { session, user } : null;
    },

    async updateSession(session) {
      const changes: {
        sessionToken?: string;
        userId?: string;
        expires?: Date;
      } = {};
      if (session.sessionToken !== undefined) {
        changes.sessionToken = session.sessionToken;
      }
      if (session.userId !== undefined) changes.userId = session.userId;
      if (session.expires !== undefined) changes.expires = session.expires;

      return db.orm.public.Session.where({
        sessionToken: session.sessionToken,
      }).update(changes);
    },

    async deleteSession(sessionToken) {
      const session = await db.orm.public.Session.first({ sessionToken });
      if (!session) return null;

      await db.orm.public.Session.where({ sessionToken }).delete();
      return session;
    },

    async createVerificationToken(token) {
      return db.orm.public.VerificationToken.create(token);
    },

    async useVerificationToken({ identifier, token }) {
      const verificationToken =
        await db.orm.public.VerificationToken.first({ identifier, token });
      if (!verificationToken) return null;

      await db.orm.public.VerificationToken.where({ identifier, token }).delete();
      return verificationToken;
    },
  } satisfies Adapter;
}
