import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '../types';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = header.split(' ')[1];
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  try {
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    if (!user.activo) {
      res.status(403).json({ message: 'Cuenta desactivada' });
      return;
    }
    if (!user.aprobado) {
      res.status(403).json({ message: 'Cuenta pendiente de aprobación' });
      return;
    }
  } catch {
    res.status(500).json({ message: 'Internal server error' });
    return;
  }

  req.user = payload;
  next();
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}
