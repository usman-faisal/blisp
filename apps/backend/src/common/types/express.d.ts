import { Prisma, User } from "@repo/db";

type UserWithoutPassword = Omit<User, 'password' | 'salt'>;

type UserPayload = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    role: true;
  };
}>;

declare global {
  namespace Express {
    interface User extends UserPayload {}
    interface Request {
      user?: UserWithoutPassword;
    }
  }
}
