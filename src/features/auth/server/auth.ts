import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getAuthEnv } from "@/lib/config/server.config";
import { PrismaOrmAdapter } from "./prisma-adapter";

const authEnv = getAuthEnv();

export const { auth, handlers } = NextAuth({
  adapter: PrismaOrmAdapter(),
  secret: authEnv.AUTH_SECRET,
  trustHost: authEnv.AUTH_TRUST_HOST,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: authEnv.AUTH_GOOGLE_ID,
      clientSecret: authEnv.AUTH_GOOGLE_SECRET,
    }),
  ],
});
