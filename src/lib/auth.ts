import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Regional, Role } from '@prisma/client';

type AuthUser = {
  id: string;
  role: Role;
  regional: Regional;
};

function isAuthUser(user: unknown): user is AuthUser {
  if (!user || typeof user !== 'object') return false;
  const candidate = user as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.regional === 'string'
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        if (!email || !credentials?.password) return null;

        // Sem diferenciar maiúsculas: o celular costuma capitalizar a 1ª letra
        // do email e o login falhava com "Email ou senha inválidos".
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          regional: user.regional,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (isAuthUser(user)) {
        token.role = user.role;
        token.regional = user.regional;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const enrichedUser = session.user as typeof session.user & {
          role?: Role;
          regional?: Regional;
          id?: string;
        };
        if (typeof token.role === 'string') enrichedUser.role = token.role as Role;
        if (typeof token.regional === 'string') enrichedUser.regional = token.regional as Regional;
        if (typeof token.id === 'string') enrichedUser.id = token.id;
      }
      return session;
    },
  },
};
