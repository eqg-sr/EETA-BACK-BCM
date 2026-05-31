// controllers/optionsController.ts
import { Request, Response } from 'express';
import { USER_ROLES, MOVIMIENTO_TIPOS, SUJETO_VINCULOS } from '../types';

export function getRolesOptions(req: Request, res: Response): void {
  res.json({
    roles: USER_ROLES
  });
}

export function getMovimientoOptions(req: Request, res: Response): void {
  res.json({
    movimientoTipos: MOVIMIENTO_TIPOS
  });
}

export function getSujetoOptions(req: Request, res: Response): void {
  res.json({
    sujetoVinculos: SUJETO_VINCULOS
  });
}