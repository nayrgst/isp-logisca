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

type OperationFlags = Pick<
  TechnicianWithCity,
  'canField' | 'canDelivery' | 'canPickup' | 'canDoorRelease' | 'canInternal'
>;
type OSCounts = Pick<
  TechnicianWithCity,
  'osField' | 'osDelivery' | 'osPickup' | 'osDoorRelease' | 'osInternal'
>;

// Uma dupla atende uma operação se pelo menos um dos membros a possui
// (ex.: técnico Field + técnico só Delivery formam uma dupla Field/Delivery).
export function getCellOperations(technicians: OperationFlags[]): OperationFlags {
  return {
    canField: technicians.some((technician) => technician.canField),
    canDelivery: technicians.some((technician) => technician.canDelivery),
    canPickup: technicians.some((technician) => technician.canPickup),
    canDoorRelease: technicians.some((technician) => technician.canDoorRelease),
    canInternal: technicians.some((technician) => technician.canInternal),
  };
}

// Soma só as operações habilitadas, igual ao total exibido no card. Assim um
// valor "sobrando" de uma dupla desfeita não infla os totais do quadro.
export function getOSLoad(counts: OSCounts, operations: OperationFlags) {
  return (
    (operations.canField ? counts.osField : 0) +
    (operations.canDelivery ? counts.osDelivery : 0) +
    (operations.canPickup ? counts.osPickup : 0) +
    (operations.canDoorRelease ? counts.osDoorRelease : 0) +
    (operations.canInternal ? counts.osInternal : 0)
  );
}

export function getTechnicianLoad(technician: TechnicianWithCity) {
  return getOSLoad(technician, technician);
}

// Membros de uma dupla guardam os mesmos valores de OS, então o primeiro serve
// de referência; as operações, porém, são a união dos membros.
export function getCellLoad(cell: Pick<TechnicianCell, 'technicians'>) {
  const reference = cell.technicians[0];
  if (!reference) return 0;
  return getOSLoad(reference, getCellOperations(cell.technicians));
}
