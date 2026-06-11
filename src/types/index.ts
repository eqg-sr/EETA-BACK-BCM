// types/index.ts
export const USER_ROLES = ['arbitro', 'demandado', 'actor', 'secretario', 'perito'] as const;
export const SUJETO_VINCULOS = ['ACTOR', 'DEMANDADO', 'TERCERO'] as const;
export const MOVIMIENTO_TIPOS = ['ACT', 'ESC', 'CED', 'MOV', 'COMENTARIO', 'SEN'] as const;
export const CAUSA_STATUSES = ['pendiente', 'iniciado', 'en_proceso', 'cerrado'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type SujetoVinculo = (typeof SUJETO_VINCULOS)[number];
export type MovimientoTipo = (typeof MOVIMIENTO_TIPOS)[number];
export type CausaStatus = (typeof CAUSA_STATUSES)[number];

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}