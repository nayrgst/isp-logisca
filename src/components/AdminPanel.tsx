'use client';

import { useState, useTransition } from 'react';
import {
  createTechnician,
  deleteTechnician,
  resetDailyOS,
  updateTechnician,
  updateTechnicianPair,
} from '@/app/actions/technician';
import { createCity, deleteCity, updateCity } from '@/app/actions/city';
import type { TechnicianWithCity } from '@/types';
import { TechnicianType, Regional } from '@prisma/client';
import { formatTechnicianCode, hasVisibleTechnicianCode } from '@/lib/technician';
import { formatDateKeyBR } from '@/lib/schedule';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface CityItem {
  id: string;
  name: string;
  order: number;
  _count: { technicians: number };
}

interface Props {
  cities: CityItem[];
  technicians: TechnicianWithCity[];
  regional: Regional;
  todayDateKey: string;
}

type Tab = 'technicians' | 'cities';

function editableCode(code: string) {
  return hasVisibleTechnicianCode(code) ? code : '';
}

function operationsOf(technician: TechnicianWithCity) {
  return {
    canField: technician.canField,
    canDelivery: technician.canDelivery,
    canPickup: technician.canPickup,
    canDoorRelease: technician.canDoorRelease,
    canInternal: technician.canInternal,
  };
}

function findPartner(technician: TechnicianWithCity, technicians: TechnicianWithCity[]) {
  if (!technician.sharedCellId) return null;
  return (
    technicians.find(
      (candidate) =>
        candidate.id !== technician.id && candidate.sharedCellId === technician.sharedCellId
    ) ?? null
  );
}

export function AdminPanel({ cities, technicians, regional, todayDateKey }: Props) {
  const [tab, setTab] = useState<Tab>('technicians');
  const [showAddTech, setShowAddTech] = useState(false);
  const [showAddCity, setShowAddCity] = useState(false);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const askConfirm = useConfirm();
  const { showToast } = useToast();

  // Add Technician form state
  const [techForm, setTechForm] = useState({
    code: '',
    name: '',
    type: 'CLT' as TechnicianType,
    osLimit: 20,
    cityId: '',
    canField: true,
    canDelivery: true,
    canPickup: false,
    canDoorRelease: false,
    canInternal: false,
    onLeave: false,
  });

  // Add City form state
  const [cityName, setCityName] = useState('');
  const [limitDrafts, setLimitDrafts] = useState<Record<string, number>>(
    Object.fromEntries(technicians.map((technician) => [technician.id, technician.osLimit]))
  );
  const [editingTechnicianId, setEditingTechnicianId] = useState<string | null>(null);
  const [editingTechnicianOptionsId, setEditingTechnicianOptionsId] = useState<string | null>(null);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [editingTechnicianCodeId, setEditingTechnicianCodeId] = useState<string | null>(null);
  const [editingTechnicianLocationId, setEditingTechnicianLocationId] = useState<string | null>(null);
  const [editingTechnicianPairId, setEditingTechnicianPairId] = useState<string | null>(null);
  const [technicianNameDrafts, setTechnicianNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(technicians.map((technician) => [technician.id, technician.name]))
  );
  const [technicianCodeDrafts, setTechnicianCodeDrafts] = useState<Record<string, string>>(
    Object.fromEntries(technicians.map((technician) => [technician.id, editableCode(technician.code)]))
  );
  const [cityNameDrafts, setCityNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(cities.map((city) => [city.id, city.name]))
  );
  const [technicianLocationDrafts, setTechnicianLocationDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      technicians.map((technician) => [
        technician.id,
        technician.onLeave ? '__ABSENT__' : technician.cityId ?? '__ABSENT__',
      ])
    )
  );
  const [technicianPairDrafts, setTechnicianPairDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      technicians.map((technician) => [
        technician.id,
        findPartner(technician, technicians)?.id ?? '__SOLO__',
      ])
    )
  );
  const [technicianOptionDrafts, setTechnicianOptionDrafts] = useState<
    Record<string, ReturnType<typeof operationsOf>>
  >(Object.fromEntries(technicians.map((technician) => [technician.id, operationsOf(technician)])));

  // Cada edição começa do valor atual do servidor: os rascunhos são criados
  // uma vez só, e sem isso abririam com o valor velho depois de outra edição.
  function startEditingName(tech: TechnicianWithCity) {
    setTechnicianNameDrafts((current) => ({ ...current, [tech.id]: tech.name }));
    setEditingTechnicianId(tech.id);
  }

  function startEditingCode(tech: TechnicianWithCity) {
    setTechnicianCodeDrafts((current) => ({ ...current, [tech.id]: editableCode(tech.code) }));
    setEditingTechnicianCodeId(tech.id);
  }

  function startEditingLocation(tech: TechnicianWithCity) {
    setTechnicianLocationDrafts((current) => ({
      ...current,
      [tech.id]: tech.onLeave ? '__ABSENT__' : tech.cityId ?? '__ABSENT__',
    }));
    setEditingTechnicianLocationId(tech.id);
  }

  function startEditingPair(tech: TechnicianWithCity) {
    setTechnicianPairDrafts((current) => ({
      ...current,
      [tech.id]: findPartner(tech, technicians)?.id ?? '__SOLO__',
    }));
    setEditingTechnicianPairId(tech.id);
  }

  function startEditingOptions(tech: TechnicianWithCity) {
    setTechnicianOptionDrafts((current) => ({ ...current, [tech.id]: operationsOf(tech) }));
    setEditingTechnicianOptionsId(tech.id);
  }

  function startEditingCity(city: CityItem) {
    setCityNameDrafts((current) => ({ ...current, [city.id]: city.name }));
    setEditingCityId(city.id);
  }

  function notify(msg: string, isError = false) {
    showToast(msg, isError ? 'error' : 'success');
  }

  // Em produção o Next troca a mensagem de erro da Server Action por um aviso
  // genérico em inglês; nesse caso mostramos o nosso texto genérico.
  function getErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    return message && !message.includes('Server Components render')
      ? message
      : 'Não foi possível salvar. Tente novamente.';
  }

  async function handleAddTech(e: React.FormEvent) {
    e.preventDefault();
    if (!techForm.name.trim()) return notify('Informe o nome do técnico', true);
    startTransition(async () => {
      try {
        await createTechnician({
          ...techForm,
          code: techForm.code.trim() || undefined,
          name: techForm.name.trim(),
          cityId: techForm.cityId || undefined,
        });
        setTechForm({
          code: '',
          name: '',
          type: 'CLT',
          osLimit: 20,
          cityId: '',
          canField: true,
          canDelivery: true,
          canPickup: false,
          canDoorRelease: false,
          canInternal: false,
          onLeave: false,
        });
        setShowAddTech(false);
        notify('Técnico adicionado com sucesso!');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleAddCity(e: React.FormEvent) {
    e.preventDefault();
    if (!cityName.trim()) return notify('Informe o nome da cidade', true);
    startTransition(async () => {
      try {
        await createCity(cityName.trim());
        setCityName('');
        setShowAddCity(false);
        notify('Cidade adicionada!');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleDeleteTech(id: string, name: string) {
    const confirmed = await askConfirm({
      title: 'Remover técnico',
      message: `${name} sairá do cadastro e do quadro. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteTechnician(id);
        notify('Técnico removido');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleDeleteCity(id: string, name: string) {
    const confirmed = await askConfirm({
      title: 'Remover cidade',
      message: `Os técnicos de ${name} vão para Ausente, inclusive nos dias já planejados. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteCity(id);
        notify('Cidade removida');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleResetOS() {
    const confirmed = await askConfirm({
      title: 'Zerar OS de hoje',
      message: `Todas as OS da regional ${regional} em ${formatDateKeyBR(todayDateKey)} voltam a zero. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Zerar OS',
      tone: 'danger',
    });
    if (!confirmed) return;
    startTransition(async () => {
      try {
        // Com a data: o quadro mostra o plano do dia, então zerar sem data
        // mexia só no cadastro e o dashboard continuava com as OS.
        await resetDailyOS(todayDateKey);
        notify('OS zeradas com sucesso!');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveLimit(id: string) {
    const osLimit = Math.max(1, limitDrafts[id] || 1);

    startTransition(async () => {
      try {
        await updateTechnician(id, { osLimit });
        notify('Limite atualizado');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveTechnicianName(id: string) {
    const name = technicianNameDrafts[id]?.trim() || '';

    startTransition(async () => {
      try {
        await updateTechnician(id, { name });
        setEditingTechnicianId(null);
        notify('Nome do técnico atualizado');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveTechnicianCode(id: string) {
    const code = technicianCodeDrafts[id] ?? '';

    startTransition(async () => {
      try {
        await updateTechnician(id, { code });
        setEditingTechnicianCodeId(null);
        notify('Código do técnico atualizado');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveTechnicianLocation(id: string) {
    const location = technicianLocationDrafts[id] ?? '__ABSENT__';

    startTransition(async () => {
      try {
        await updateTechnician(id, {
          cityId: location === '__ABSENT__' ? null : location,
        });
        setEditingTechnicianLocationId(null);
        notify('Lotação do técnico atualizada');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveTechnicianOptions(id: string) {
    const options = technicianOptionDrafts[id];

    startTransition(async () => {
      try {
        await updateTechnician(id, options);
        setEditingTechnicianOptionsId(null);
        notify('Opções do técnico atualizadas');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveTechnicianPair(id: string) {
    const partnerId = technicianPairDrafts[id] ?? '__SOLO__';

    startTransition(async () => {
      try {
        await updateTechnicianPair(id, partnerId === '__SOLO__' ? null : partnerId);
        setEditingTechnicianPairId(null);
        notify(partnerId === '__SOLO__' ? 'Dupla removida' : 'Dupla atualizada');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  async function handleSaveCityName(id: string) {
    const name = cityNameDrafts[id]?.trim() || '';

    startTransition(async () => {
      try {
        await updateCity(id, name);
        setEditingCityId(null);
        notify('Nome da cidade atualizado');
      } catch (error: unknown) {
        notify(getErrorMessage(error), true);
      }
    });
  }

  const filteredTechnicians = technicians.filter((tech) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return (
      tech.name.toLowerCase().includes(term) ||
      tech.code.toLowerCase().includes(term) ||
      tech.city?.name.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ink">Administração</h2>
          <p className="text-ink-subtle text-sm mt-1">Regional {regional}</p>
        </div>
        <button
          type="button"
          onClick={handleResetOS}
          disabled={isPending}
          className="rounded-card border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-[background-color,border-color,transform] duration-150 hover:border-danger/70 hover:bg-danger/20 active:scale-[0.98] disabled:opacity-50"
        >
          Zerar OS de hoje
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-line rounded-card p-1 w-fit">
        {(['technicians', 'cities'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-control text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98]
              ${tab === t ? 'bg-surface-hover text-ink' : 'text-ink-subtle hover:text-ink'}`}
          >
            {t === 'technicians'
              ? `Técnicos (${technicians.length})`
              : `Cidades (${cities.length})`}
          </button>
        ))}
      </div>

      {/* ── TECHNICIANS TAB ──────────────────────────────────────────── */}
      {tab === 'technicians' && (
        <div>
          <div className="flex justify-end mb-4">
            <div className="mr-auto max-w-xs w-full">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar técnico, código ou cidade"
                className="w-full rounded-card border border-line bg-surface px-4 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <button
              onClick={() => setShowAddTech(!showAddTech)}
              className="px-4 py-2 bg-brand hover:bg-brand-strong text-white rounded-card text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98]"
            >
              + Adicionar Técnico
            </button>
          </div>

          {/* Add Technician Form */}
          {showAddTech && (
            <div className="mb-6 bg-surface border border-line-strong rounded-panel p-5">
              <h3 className="text-ink font-semibold mb-4">Novo Técnico</h3>
              <form onSubmit={handleAddTech} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Código</label>
                  <input
                    value={techForm.code}
                    onChange={(e) => setTechForm({ ...techForm, code: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    Se deixar em branco, o sistema guarda um identificador interno e mostra
                    &quot;Sem código&quot; na interface.
                  </p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs text-ink-muted mb-1">Nome *</label>
                  <input
                    value={techForm.name}
                    onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                    placeholder="Nome do técnico"
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Tipo</label>
                  <select
                    value={techForm.type}
                    onChange={(e) =>
                      setTechForm((current) => ({
                        ...current,
                        type: e.target.value as TechnicianType,
                        canField: e.target.value === 'CLT',
                        canDelivery: true,
                      }))
                    }
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="CLT">CLT</option>
                    <option value="TER">TER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Limite de OS</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={techForm.osLimit}
                    onChange={(e) =>
                      setTechForm({ ...techForm, osLimit: parseInt(e.target.value) || 20 })
                    }
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Lotação inicial</label>
                  <select
                    value={techForm.cityId}
                    onChange={(e) =>
                      setTechForm((current) => ({
                        ...current,
                        cityId: e.target.value,
                        onLeave: e.target.value === '',
                      }))
                    }
                    className="w-full px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Ausente</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="mb-2 block text-xs text-ink-muted">Opções do técnico</label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      { key: 'canDelivery', label: 'Delivery' },
                      { key: 'canField', label: 'Field' },
                      { key: 'canPickup', label: 'Retirada' },
                      { key: 'canDoorRelease', label: 'Liberação de porta' },
                      { key: 'canInternal', label: 'Interno' },
                      { key: 'onLeave', label: 'Ausente' },
                    ].map((option) => (
                      <label
                        key={option.key}
                        className="flex items-center gap-2 rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink-muted"
                      >
                        <input
                          type="checkbox"
                          checked={
                            techForm[option.key as keyof typeof techForm] as boolean
                          }
                          onChange={(e) =>
                            setTechForm((current) => ({
                              ...current,
                              [option.key]: e.target.checked,
                              ...(option.key === 'onLeave'
                                ? { cityId: e.target.checked ? '' : current.cityId }
                                : {}),
                            }))
                          }
                          className="rounded border-line-strong bg-surface accent-brand"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-3 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddTech(false)}
                    className="px-4 py-2 text-ink-muted hover:text-ink text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 bg-brand hover:bg-brand-strong text-white rounded-card text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isPending ? 'Salvando...' : 'Criar Técnico'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="mb-2 text-xs text-ink-subtle">
            Lotação e dupla aqui são o <span className="text-ink-muted">padrão</span> do técnico,
            usado nos dias ainda não mexidos no quadro. Ajustes feitos no quadro valem só para
            aquele dia.
          </p>

          {/* Technicians Table */}
          <div className="overflow-x-auto rounded-panel border border-line bg-surface">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Código
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Lotação
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Dupla
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider"
                    title="Carga de hoje, a mesma do quadro"
                  >
                    Field hoje
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider"
                    title="Carga de hoje, a mesma do quadro"
                  >
                    Del. hoje
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Limite
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Opções
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredTechnicians.map((tech) => (
                  <tr key={tech.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 text-ink-muted text-sm font-mono">
                      {editingTechnicianCodeId === tech.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={technicianCodeDrafts[tech.id] ?? ''}
                            onChange={(e) =>
                              setTechnicianCodeDrafts((current) => ({
                                ...current,
                                [tech.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTechnicianCode(tech.id);
                              if (e.key === 'Escape') setEditingTechnicianCodeId(null);
                            }}
                            placeholder="Sem código"
                            className="w-full min-w-[8rem] rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTechnicianCode(tech.id)}
                            disabled={isPending}
                            className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingTechnicianCodeId(null)}
                            className="text-xs text-ink-subtle hover:text-ink"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap">{formatTechnicianCode(tech.code)}</span>
                          <button
                            onClick={() => startEditingCode(tech)}
                            className="text-xs text-ink-subtle hover:text-os-field"
                            title="Editar código do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink text-sm font-medium">
                      {editingTechnicianId === tech.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={technicianNameDrafts[tech.id] ?? tech.name}
                            onChange={(e) =>
                              setTechnicianNameDrafts((current) => ({
                                ...current,
                                [tech.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTechnicianName(tech.id);
                              if (e.key === 'Escape') setEditingTechnicianId(null);
                            }}
                            className="w-full min-w-[8rem] rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTechnicianName(tech.id)}
                            disabled={isPending}
                            className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingTechnicianId(null)}
                            className="text-xs text-ink-subtle hover:text-ink"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{tech.name}</span>
                          <button
                            onClick={() => startEditingName(tech)}
                            className="text-xs text-ink-subtle hover:text-os-field"
                            title="Editar nome do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-control font-medium
                        ${tech.type === 'CLT' ? 'bg-os-field/10 text-os-field' : 'bg-absent/10 text-absent'}`}
                      >
                        {tech.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted">
                      {editingTechnicianLocationId === tech.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={technicianLocationDrafts[tech.id] ?? '__ABSENT__'}
                            onChange={(e) =>
                              setTechnicianLocationDrafts((current) => ({
                                ...current,
                                [tech.id]: e.target.value,
                              }))
                            }
                            className="w-full min-w-[8rem] rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                            autoFocus
                          >
                            <option value="__ABSENT__">Ausente</option>
                            {cities.map((city) => (
                              <option key={city.id} value={city.id}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveTechnicianLocation(tech.id)}
                            disabled={isPending}
                            className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingTechnicianLocationId(null)}
                            className="text-xs text-ink-subtle hover:text-ink"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={tech.onLeave || !tech.city ? 'text-absent' : undefined}>
                            {tech.onLeave ? 'Ausente' : tech.city?.name ?? 'Ausente'}
                          </span>
                          <button
                            onClick={() => startEditingLocation(tech)}
                            className="text-xs text-ink-subtle hover:text-os-field"
                            title="Editar lotação do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted">
                      {editingTechnicianPairId === tech.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={technicianPairDrafts[tech.id] ?? '__SOLO__'}
                            onChange={(e) =>
                              setTechnicianPairDrafts((current) => ({
                                ...current,
                                [tech.id]: e.target.value,
                              }))
                            }
                            className="w-full min-w-[8rem] rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                            autoFocus
                          >
                            <option value="__SOLO__">Individual</option>
                            {technicians
                              .filter(
                                (candidate) =>
                                  candidate.id !== tech.id &&
                                  (candidate.cityId ?? null) === (tech.cityId ?? null) &&
                                  candidate.onLeave === tech.onLeave
                              )
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                  {candidate.sharedCellId && candidate.sharedCellId !== tech.sharedCellId
                                    ? ' • já em dupla'
                                    : ''}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => handleSaveTechnicianPair(tech.id)}
                            disabled={isPending}
                            className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingTechnicianPairId(null)}
                            className="text-xs text-ink-subtle hover:text-ink"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{findPartner(tech, technicians)?.name ?? 'Individual'}</span>
                          <button
                            onClick={() => startEditingPair(tech)}
                            className="text-xs text-ink-subtle hover:text-os-field"
                            title="Editar dupla do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-os-field text-sm font-medium">
                      {tech.canField ? tech.osField : '—'}
                    </td>
                    <td className="px-4 py-3 text-os-delivery text-sm font-medium">
                      {tech.canDelivery ? tech.osDelivery : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={limitDrafts[tech.id] ?? tech.osLimit}
                          onChange={(e) =>
                            setLimitDrafts((current) => ({
                              ...current,
                              [tech.id]: parseInt(e.target.value, 10) || 1,
                            }))
                          }
                          className="w-24 rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <button
                          onClick={() => handleSaveLimit(tech.id)}
                          disabled={isPending}
                          className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                        >
                          Salvar
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingTechnicianOptionsId === tech.id ? (
                        <div className="space-y-2">
                          <div className="grid gap-2">
                            {/* Sem "Ausente" aqui: ausência é lotação (coluna
                                ao lado). O checkbox daqui só conseguia marcar —
                                desmarcar não devolvia o técnico a cidade nenhuma. */}
                            {(
                              [
                                { key: 'canDelivery', label: 'Delivery' },
                                { key: 'canField', label: 'Field' },
                                { key: 'canPickup', label: 'Retirada' },
                                { key: 'canDoorRelease', label: 'Liberação de porta' },
                                { key: 'canInternal', label: 'Interno' },
                              ] as const
                            ).map((option) => (
                              <label
                                key={option.key}
                                className="flex items-center gap-2 text-xs text-ink-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={technicianOptionDrafts[tech.id]?.[option.key] ?? false}
                                  onChange={(e) =>
                                    setTechnicianOptionDrafts((current) => ({
                                      ...current,
                                      [tech.id]: {
                                        ...current[tech.id],
                                        [option.key]: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded border-line-strong bg-surface accent-brand"
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveTechnicianOptions(tech.id)}
                              disabled={isPending}
                              className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingTechnicianOptionsId(null)}
                              className="text-xs text-ink-subtle hover:text-ink"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tech.canDelivery && (
                            <span className="rounded bg-os-delivery/10 px-1.5 py-0.5 text-xs text-os-delivery">
                              Delivery
                            </span>
                          )}
                          {tech.canField && (
                            <span className="rounded bg-os-field/10 px-1.5 py-0.5 text-xs text-os-field">
                              Field
                            </span>
                          )}
                          {tech.canPickup && (
                            <span className="rounded bg-os-pickup/10 px-1.5 py-0.5 text-xs text-os-pickup">
                              Retirada
                            </span>
                          )}
                          {tech.canDoorRelease && (
                            <span className="rounded bg-os-door/10 px-1.5 py-0.5 text-xs text-os-door">
                              Lib. porta
                            </span>
                          )}
                          {tech.canInternal && (
                            <span className="rounded bg-os-internal/10 px-1.5 py-0.5 text-xs text-os-internal">
                              Interno
                            </span>
                          )}
                          <button
                            onClick={() => startEditingOptions(tech)}
                            className="ml-1 text-xs text-ink-subtle hover:text-os-field"
                            title="Editar opções do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteTech(tech.id, tech.name)}
                        disabled={isPending}
                        className="text-ink-subtle hover:text-danger transition-colors disabled:opacity-30"
                        title="Remover técnico"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTechnicians.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-ink-subtle">
                      Nenhum técnico encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CITIES TAB ───────────────────────────────────────────────── */}
      {tab === 'cities' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddCity(!showAddCity)}
              className="px-4 py-2 bg-brand hover:bg-brand-strong text-white rounded-card text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98]"
            >
              + Adicionar Cidade
            </button>
          </div>

          {showAddCity && (
            <div className="mb-6 bg-surface border border-line-strong rounded-panel p-5">
              <h3 className="text-ink font-semibold mb-4">Nova Cidade — {regional}</h3>
              <form onSubmit={handleAddCity} className="flex gap-3">
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Nome da cidade"
                  className="flex-1 px-3 py-2 bg-surface-raised border border-line-strong rounded-control text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowAddCity(false)}
                  className="px-4 py-2 text-ink-muted hover:text-ink text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-brand hover:bg-brand-strong text-white rounded-card text-sm font-medium disabled:opacity-50"
                >
                  {isPending ? 'Salvando...' : 'Adicionar'}
                </button>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((city) => (
              <div
                key={city.id}
                className="bg-surface border border-line rounded-panel p-4 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1 pr-3">
                  {editingCityId === city.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={cityNameDrafts[city.id] ?? city.name}
                        onChange={(e) =>
                          setCityNameDrafts((current) => ({
                            ...current,
                            [city.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCityName(city.id);
                          if (e.key === 'Escape') setEditingCityId(null);
                        }}
                        className="w-full min-w-[8rem] rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveCityName(city.id)}
                        disabled={isPending}
                        className="text-xs text-brand-strong transition-colors duration-150 hover:text-ink disabled:opacity-40"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingCityId(null)}
                        className="text-xs text-ink-subtle hover:text-ink"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-ink font-semibold">{city.name}</h4>
                      <button
                        onClick={() => startEditingCity(city)}
                        className="text-xs text-ink-subtle hover:text-os-field"
                        title="Editar nome da cidade"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                  <p className="text-ink-subtle text-sm mt-0.5">{city._count.technicians} técnicos</p>
                </div>
                <button
                  onClick={() => handleDeleteCity(city.id, city.name)}
                  disabled={isPending}
                  className="p-2 text-ink-subtle hover:text-danger transition-colors disabled:opacity-30 rounded-control hover:bg-surface-raised"
                  title="Remover cidade"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
            {cities.length === 0 && (
              <div className="col-span-3 text-center py-12 text-ink-subtle">
                Nenhuma cidade cadastrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
