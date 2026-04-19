import type { Role, Regional, TechnicianType } from '@prisma/client';

export type { Role, Regional, TechnicianType };

export interface TechnicianWithCity {
  id: string;
  code: string;
  name: string;
  type: TechnicianType;
  osField: number;
  osDelivery: number;
  osLimit: number;
  onLeave: boolean;
  onPickup: boolean;
  regional: Regional;
  cityId: string | null;
  city: {
    id: string;
    name: string;
    regional: Regional;
  } | null;
}

export interface CityWithTechnicians {
  id: string;
  name: string;
  regional: Regional;
  order: number;
  technicians: TechnicianWithCity[];
}

export type FilterMode = 'ALL' | 'FIELD' | 'DELIVERY';
