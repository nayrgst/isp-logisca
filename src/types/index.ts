import type { Role, Regional, TechnicianType } from '@prisma/client';

export type { Role, Regional, TechnicianType };

export interface TechnicianWithCity {
  id: string;
  code: string;
  name: string;
  type: TechnicianType;
  canField: boolean;
  canDelivery: boolean;
  canPickup: boolean;
  canDoorRelease: boolean;
  osField: number;
  osDelivery: number;
  osPickup: number;
  osDoorRelease: number;
  osLimit: number;
  onLeave: boolean;
  onPickup: boolean;
  regional: Regional;
  cityId: string | null;
  supportCityId: string | null;
  order: number;
  sharedCellId: string | null;
  city: {
    id: string;
    name: string;
    regional: Regional;
  } | null;
  supportCity: {
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
  isVirtual?: boolean;
}

export type FilterMode = 'ALL' | 'FIELD' | 'DELIVERY';
export type RegionalView = 'ALL' | Regional;

export interface TechnicianCell {
  id: string;
  regional: Regional;
  cityId: string | null;
  sharedCellId: string | null;
  technicians: TechnicianWithCity[];
}

export interface DailyScheduleConfig {
  enabled: boolean;
  selectedDate: string;
  todayDate: string;
  isEditable: boolean;
  minDate: string;
  maxDate: string;
}
