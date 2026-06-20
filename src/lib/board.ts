import type { CityWithTechnicians, FilterMode, TechnicianCell, TechnicianWithCity } from '@/types';

function sortTechnicians(a: TechnicianWithCity, b: TechnicianWithCity) {
  if (a.order !== b.order) return a.order - b.order;
  return a.name.localeCompare(b.name, 'pt-BR');
}

export function buildTechnicianCells(
  technicians: TechnicianWithCity[],
  city: Pick<CityWithTechnicians, 'id' | 'regional'>
): TechnicianCell[] {
  const sorted = [...technicians].sort(sortTechnicians);
  const cells: TechnicianCell[] = [];
  const visitedGroups = new Set<string>();

  for (const technician of sorted) {
    if (technician.sharedCellId) {
      if (visitedGroups.has(technician.sharedCellId)) continue;
      visitedGroups.add(technician.sharedCellId);

      const groupedTechnicians = sorted.filter(
        (candidate) => candidate.sharedCellId === technician.sharedCellId
      );

      cells.push({
        id: `group:${technician.sharedCellId}`,
        regional: city.regional,
        cityId: city.id.startsWith('__UNASSIGNED__') ? null : city.id,
        sharedCellId: technician.sharedCellId,
        technicians: groupedTechnicians,
      });
      continue;
    }

    cells.push({
      id: `tech:${technician.id}`,
      regional: city.regional,
      cityId: city.id.startsWith('__UNASSIGNED__') ? null : city.id,
      sharedCellId: null,
      technicians: [technician],
    });
  }

  return cells;
}

export function flattenCellsToTechnicians(
  cells: TechnicianCell[],
  city: Pick<CityWithTechnicians, 'id' | 'name' | 'regional' | 'isVirtual'>
) {
  let nextOrder = 0;

  return cells.flatMap((cell) =>
    [...cell.technicians].sort(sortTechnicians).map((technician) => ({
      ...technician,
      order: nextOrder++,
      cityId: city.isVirtual ? null : city.id,
      onLeave: Boolean(city.isVirtual),
      supportCityId: technician.supportCityId === city.id ? null : technician.supportCityId,
      city: city.isVirtual
        ? null
        : {
            id: city.id,
            name: city.name,
            regional: city.regional,
          },
    }))
  );
}

export function doesTechnicianMatchFilters(
  technician: TechnicianWithCity,
  filterMode: FilterMode,
  search: string
) {
  const normalizedSearch = search.trim().toLowerCase();

  if (filterMode === 'MEI' && technician.type !== 'TER') return false;
  if (filterMode === 'CLT' && technician.type !== 'CLT') return false;

  if (!normalizedSearch) return true;

  return (
    technician.name.toLowerCase().includes(normalizedSearch) ||
    technician.code.toLowerCase().includes(normalizedSearch)
  );
}

export function doesCellMatchFilters(
  cell: TechnicianCell,
  filterMode: FilterMode,
  search: string
) {
  return cell.technicians.some((technician) =>
    doesTechnicianMatchFilters(technician, filterMode, search)
  );
}

export function getTechnicianLoad(technician: TechnicianWithCity) {
  return (
    technician.osField +
    technician.osDelivery +
    technician.osPickup +
    technician.osDoorRelease
  );
}
