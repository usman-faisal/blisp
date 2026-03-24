import { Prisma } from "@repo/db";

export const userSelect = {
  id: true,
  email: true,
  name: true,
  hasNotifications: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserSelect = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

export const minimalUserSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect;

export type MinimalUserSelect = Prisma.UserGetPayload<{
  select: typeof minimalUserSelect;
}>;
