'use client';

import { useState, useTransition } from 'react';
import {
  createTechnician,
  deleteTechnician,
  resetDailyOS,
  updateTechnician,
} from '@/app/actions/technician';
import { createCity, deleteCity, updateCity } from '@/app/actions/city';
import type { TechnicianWithCity } from '@/types';
import { TechnicianType, Regional } from '@prisma/client';
import { formatTechnicianCode } from '@/lib/technician';

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
}

type Tab = 'technicians' | 'cities';

export function AdminPanel({ cities, technicians, regional }: Props) {
  const [tab, setTab] = useState<Tab>('technicians');
  const [showAddTech, setShowAddTech] = useState(false);
  const [showAddCity, setShowAddCity] = useState(false);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Technician form state
  const [techForm, setTechForm] = useState({
    code: '',
    name: '',
    type: 'CLT' as TechnicianType,
    osLimit: 10,
    cityId: '',
  });

  // Add City form state
  const [cityName, setCityName] = useState('');
  const [limitDrafts, setLimitDrafts] = useState<Record<string, number>>(
    Object.fromEntries(technicians.map((technician) => [technician.id, technician.osLimit]))
  );
  const [editingTechnicianId, setEditingTechnicianId] = useState<string | null>(null);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [technicianNameDrafts, setTechnicianNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(technicians.map((technician) => [technician.id, technician.name]))
  );
  const [cityNameDrafts, setCityNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(cities.map((city) => [city.id, city.name]))
  );

  function notify(msg: string, isError = false) {
    if (isError) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  }

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Erro inesperado';
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
        setTechForm({ code: '', name: '', type: 'CLT', osLimit: 10, cityId: '' });
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
    if (!confirm(`Remover técnico ${name}?`)) return;
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
    if (!confirm(`Remover cidade ${name}? Os técnicos serão desvinculados.`)) return;
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
    if (!confirm('Zerar todas as OS do dia? Essa ação não pode ser desfeita.')) return;
    startTransition(async () => {
      try {
        await resetDailyOS();
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
          <h2 className="text-2xl font-bold text-white">Administração</h2>
          <p className="text-gray-500 text-sm mt-1">Regional {regional}</p>
        </div>
        <button
          onClick={handleResetOS}
          disabled={isPending}
          className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-400
                     hover:text-red-300 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          🔄 Zerar OS do dia
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-800 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-green-950 border border-green-800 rounded-xl text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {(['technicians', 'cities'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            {t === 'technicians'
              ? `👷 Técnicos (${technicians.length})`
              : `🏙️ Cidades (${cities.length})`}
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
                placeholder="Buscar tecnico, codigo ou cidade"
                className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAddTech(!showAddTech)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              + Adicionar Técnico
            </button>
          </div>

          {/* Add Technician Form */}
          {showAddTech && (
            <div className="mb-6 bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Novo Técnico</h3>
              <form onSubmit={handleAddTech} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Codigo</label>
                  <input
                    value={techForm.code}
                    onChange={(e) => setTechForm({ ...techForm, code: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Se deixar em branco, o sistema guarda um identificador interno e mostra
                    &quot;Sem codigo&quot; na interface.
                  </p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                  <input
                    value={techForm.name}
                    onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                    placeholder="Nome do técnico"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select
                    value={techForm.type}
                    onChange={(e) =>
                      setTechForm({ ...techForm, type: e.target.value as TechnicianType })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CLT">CLT (Field + Delivery)</option>
                    <option value="TER">TER (Delivery only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Limite de OS</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={techForm.osLimit}
                    onChange={(e) =>
                      setTechForm({ ...techForm, osLimit: parseInt(e.target.value) || 10 })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cidade inicial</label>
                  <select
                    value={techForm.cityId}
                    onChange={(e) => setTechForm({ ...techForm, cityId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sem cidade</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-3 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddTech(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {isPending ? 'Salvando...' : 'Criar Técnico'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Technicians Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cidade
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OS Field
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OS Del.
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Limite
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredTechnicians.map((tech) => (
                  <tr key={tech.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-sm font-mono">
                      {formatTechnicianCode(tech.code)}
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-medium">
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
                              if (e.key === 'Escape') {
                                setEditingTechnicianId(null);
                                setTechnicianNameDrafts((current) => ({
                                  ...current,
                                  [tech.id]: tech.name,
                                }));
                              }
                            }}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTechnicianName(tech.id)}
                            disabled={isPending}
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setEditingTechnicianId(null);
                              setTechnicianNameDrafts((current) => ({
                                ...current,
                                [tech.id]: tech.name,
                              }));
                            }}
                            className="text-xs text-gray-500 hover:text-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{tech.name}</span>
                          <button
                            onClick={() => setEditingTechnicianId(tech.id)}
                            className="text-xs text-gray-500 hover:text-blue-400"
                            title="Editar nome do técnico"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-medium
                        ${tech.type === 'CLT' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}
                      >
                        {tech.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{tech.city?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-blue-400 text-sm font-medium">
                      {tech.type === 'CLT' ? tech.osField : '—'}
                    </td>
                    <td className="px-4 py-3 text-green-400 text-sm font-medium">
                      {tech.osDelivery}
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
                          className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleSaveLimit(tech.id)}
                          disabled={isPending}
                          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
                        >
                          Salvar
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {tech.onLeave && (
                          <span className="text-xs bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded">
                            Folga
                          </span>
                        )}
                        {tech.onPickup && (
                          <span className="text-xs bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded">
                            Retirada
                          </span>
                        )}
                        {!tech.onLeave && !tech.onPickup && (
                          <span className="text-xs text-gray-600">Ativo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteTech(tech.id, tech.name)}
                        disabled={isPending}
                        className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
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
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-600">
                      Nenhum tecnico encontrado
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              + Adicionar Cidade
            </button>
          </div>

          {showAddCity && (
            <div className="mb-6 bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Nova Cidade — {regional}</h3>
              <form onSubmit={handleAddCity} className="flex gap-3">
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Nome da cidade"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAddCity(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
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
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
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
                          if (e.key === 'Escape') {
                            setEditingCityId(null);
                            setCityNameDrafts((current) => ({
                              ...current,
                              [city.id]: city.name,
                            }));
                          }
                        }}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveCityName(city.id)}
                        disabled={isPending}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setEditingCityId(null);
                          setCityNameDrafts((current) => ({
                            ...current,
                            [city.id]: city.name,
                          }));
                        }}
                        className="text-xs text-gray-500 hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-white font-semibold">{city.name}</h4>
                      <button
                        onClick={() => setEditingCityId(city.id)}
                        className="text-xs text-gray-500 hover:text-blue-400"
                        title="Editar nome da cidade"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                  <p className="text-gray-500 text-sm mt-0.5">{city._count.technicians} técnicos</p>
                </div>
                <button
                  onClick={() => handleDeleteCity(city.id, city.name)}
                  disabled={isPending}
                  className="p-2 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30 rounded-lg hover:bg-gray-800"
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
              <div className="col-span-3 text-center py-12 text-gray-600">
                Nenhuma cidade cadastrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
