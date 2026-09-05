import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ message: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}
