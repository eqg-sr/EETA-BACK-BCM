import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: any, res: Response, next: NextFunction) => Promise<any>;

/** Wraps an async route handler so rejected promises are forwarded to Express's error handler instead of crashing the process. */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
