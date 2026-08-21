/**
 * express.d.ts — extends the Express Request interface to include req.user.
 *
 * WHY: Express's built-in Request type has no `user` property. When the
 * authenticate middleware injects `req.user`, TypeScript throws a type error
 * everywhere you use it. This declaration merges our custom properties into
 * the global Express namespace — no imports needed, it applies everywhere.
 *
 * This file must be included in tsconfig (covered by "src/**\/*").
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: "ADMIN" | "DISPATCHER";
      };
    }
  }
}

// This export makes the file a module (required for declaration merging to work)
export {};
