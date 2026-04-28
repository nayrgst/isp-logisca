'use client';

import { useMemo, useState } from 'react';
import { Regional } from '@prisma/client';

type ToolTab = 'CLOSURE' | 'ANTICIPATION' | 'NONCONFORMITY';
type ClosureType = 'DELIVERY' | 'FIELD';
type SectorKey =
  | 'COMERCIAL_INTERNO'
  | 'CRM'
  | 'REVENDA'
  | 'ASR'
  | 'MUNDIALE'
  | 'PME'
  | 'PAP';

const sectorOptions: Array<{ value: SectorKey; label: string; contacts: string }> = [
  { value: 'COMERCIAL_INTERNO', label: 'Comercial interno', contacts: 'Darlan' },
  { value: 'CRM', label: 'CRM', contacts: 'CRM' },
  { value: 'REVENDA', label: 'Revenda', contacts: 'Evelyn Wagner' },
  { value: 'ASR', label: 'ASR', contacts: 'Dennis' },
  { value: 'MUNDIALE', label: 'Mundiale', contacts: 'Darlan' },
  { value: 'PME', label: 'PME', contacts: 'Ana Beatriz, Daiana e Luiz Eduardo' },
  { value: 'PAP', label: 'PAP', contacts: 'Karen Safyra Rosana Ferreira' },
];

function extractOs(rawServiceInfo: string, rawTechnicianMessage = '') {
  const combined = `${rawServiceInfo}\n${rawTechnicianMessage}`;
  const match = combined.match(/N[°ºo]?\s*OS[:.]?\s*([0-9]+)/i) ?? combined.match(/\b([0-9]{12,})\b/);
  return match?.[1] ?? '';
}

function extractClient(rawServiceInfo: string) {
  const line = rawServiceInfo.trim();
  const pipeIndex = line.indexOf('|');
  if (pipeIndex >= 0) {
    return line.slice(pipeIndex + 1).trim();
  }

  const fallback = line.match(/\(\d+\)\s*.+$/);
  return fallback?.[0]?.trim() ?? '';
}

function extractReason(rawTechnicianMessage: string) {
  const compact = rawTechnicianMessage.replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  const technicianMatch = compact.match(/pelo técnico\s+(.+)$/i);
  if (technicianMatch?.[1]) {
    return technicianMatch[1].trim();
  }

  return compact;
}

function buildClosureText(params: {
  osNumber: string;
  client: string;
  reason: string;
  type: ClosureType;
  contacts: string;
}) {
  const typeLabel = params.type === 'DELIVERY' ? 'Delivery' : 'Field';

  return [
    `❌Encerramento OS ${typeLabel}.`,
    `Cliente: ${params.client || 'Não identificado'}`,
    `N° OS: ${params.osNumber || 'Não identificado'}`,
    `Motivo: ${params.reason || 'Não informado'}`,
    '',
    params.contacts,
  ].join('\n');
}

function buildAnticipationText(regional: Regional, items: Array<{ client: string; osNumber: string }>) {
  const lines = [`*ANTECIPAÇÃO ${regional}*`, ''];

  items.forEach((item, index) => {
    lines.push(`Cliente: ${item.client || 'Não identificado'}`);
    lines.push(`O.S. Nº ${item.osNumber || 'Não identificado'}`);

    if (index < items.length - 1) {
      lines.push('');
      lines.push('');
    }
  });

  return lines.join('\n').trim();
}

function buildNonconformityText(params: {
  client: string;
  osNumber: string;
  regional: Regional;
  sector: string;
  error: string;
}) {
  return [
    `CLIENTE: ${params.client || 'Não identificado'}`,
    `O.S.: ${params.osNumber || 'Não identificado'}`,
    `REGIONAL: ${params.regional}`,
    `SETOR QUE ABRIU A O.S.: ${params.sector}`,
    `ERRO ENCONTRADO: ${params.error || 'Não informado'}`,
  ].join('\n');
}

export function ClosurePanel() {
  const [activeTab, setActiveTab] = useState<ToolTab>('CLOSURE');

  const [serviceInfo, setServiceInfo] = useState('');
  const [technicianMessage, setTechnicianMessage] = useState('');
  const [sector, setSector] = useState<SectorKey>('COMERCIAL_INTERNO');
  const [closureType, setClosureType] = useState<ClosureType>('DELIVERY');
  const [generatedText, setGeneratedText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const [anticipationRegional, setAnticipationRegional] = useState<Regional>(Regional.DF02);
  const [anticipationInput, setAnticipationInput] = useState('');
  const [anticipationItems, setAnticipationItems] = useState<Array<{ client: string; osNumber: string }>>([]);
  const [anticipationFeedback, setAnticipationFeedback] = useState('');

  const [nonconformityServiceInfo, setNonconformityServiceInfo] = useState('');
  const [nonconformityRegional, setNonconformityRegional] = useState<Regional>(Regional.DF02);
  const [nonconformitySector, setNonconformitySector] = useState<SectorKey>('CRM');
  const [nonconformityError, setNonconformityError] = useState('');
  const [nonconformityText, setNonconformityText] = useState('');
  const [nonconformityFeedback, setNonconformityFeedback] = useState('');

  const parsedClosure = useMemo(() => {
    const osNumber = extractOs(serviceInfo, technicianMessage);
    const client = extractClient(serviceInfo);
    const reason = extractReason(technicianMessage);
    const selectedSector = sectorOptions.find((option) => option.value === sector);

    return {
      osNumber,
      client,
      reason,
      contacts: selectedSector?.contacts ?? '',
    };
  }, [sector, serviceInfo, technicianMessage]);

  const parsedAnticipation = useMemo(
    () => ({
      osNumber: extractOs(anticipationInput),
      client: extractClient(anticipationInput),
    }),
    [anticipationInput]
  );

  const parsedNonconformity = useMemo(
    () => ({
      osNumber: extractOs(nonconformityServiceInfo),
      client: extractClient(nonconformityServiceInfo),
      sectorLabel: sectorOptions.find((option) => option.value === nonconformitySector)?.label ?? '',
    }),
    [nonconformitySector, nonconformityServiceInfo]
  );

  const anticipationText = useMemo(
    () => buildAnticipationText(anticipationRegional, anticipationItems),
    [anticipationItems, anticipationRegional]
  );

  function clearFeedback(setter: (value: string) => void, delay = 2000) {
    window.setTimeout(() => setter(''), delay);
  }

  function handleGenerateClosure() {
    setGeneratedText(
      buildClosureText({
        osNumber: parsedClosure.osNumber,
        client: parsedClosure.client,
        reason: parsedClosure.reason,
        type: closureType,
        contacts: parsedClosure.contacts,
      })
    );
    setCopyFeedback('');
  }

  async function handleCopy(text: string, setter: (value: string) => void) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setter('Texto copiado!');
      clearFeedback(setter);
    } catch {
      setter('Não foi possível copiar.');
      clearFeedback(setter, 2500);
    }
  }

  function handleAddAnticipation() {
    if (!parsedAnticipation.client && !parsedAnticipation.osNumber) return;

    setAnticipationItems((current) => [
      ...current,
      {
        client: parsedAnticipation.client,
        osNumber: parsedAnticipation.osNumber,
      },
    ]);
    setAnticipationInput('');
    setAnticipationFeedback('Cliente adicionado!');
    clearFeedback(setAnticipationFeedback);
  }

  function handleClearAnticipation() {
    setAnticipationItems([]);
    setAnticipationInput('');
    setAnticipationFeedback('');
  }

  function handleGenerateNonconformity() {
    setNonconformityText(
      buildNonconformityText({
        client: parsedNonconformity.client,
        osNumber: parsedNonconformity.osNumber,
        regional: nonconformityRegional,
        sector: parsedNonconformity.sectorLabel,
        error: nonconformityError.trim(),
      })
    );
    setNonconformityFeedback('');
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Central de Textos</h2>
        <p className="mt-1 text-sm text-gray-400">
          Gere rapidamente textos operacionais de encerramento, antecipação e inconformidade.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
        {[
          { key: 'CLOSURE' as const, label: 'Encerramento' },
          { key: 'ANTICIPATION' as const, label: 'Antecipação' },
          { key: 'NONCONFORMITY' as const, label: 'Inconformidade' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'CLOSURE' && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Dados da OS e cliente
                </label>
                <textarea
                  value={serviceInfo}
                  onChange={(e) => setServiceInfo(e.target.value)}
                  placeholder="N° OS: 010626070163839586 | (292604) GUILHERME HENRIQUE BARBOSA"
                  className="min-h-28 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Mensagem do técnico
                </label>
                <textarea
                  value={technicianMessage}
                  onChange={(e) => setTechnicianMessage(e.target.value)}
                  placeholder="A ordem de serviço de número 010626070163839586..."
                  className="min-h-40 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Setor responsável
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as SectorKey)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sectorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Tipo de encerramento
                  </label>
                  <select
                    value={closureType}
                    onChange={(e) => setClosureType(e.target.value as ClosureType)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DELIVERY">Delivery</option>
                    <option value="FIELD">Field</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateClosure}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Gerar texto
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedText, setCopyFeedback)}
                  disabled={!generatedText}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copiar
                </button>
                {copyFeedback && <span className="text-sm text-green-400">{copyFeedback}</span>}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-400">
              Prévia
            </h3>

            <div className="mt-4 grid gap-3 rounded-xl border border-gray-800 bg-gray-950/80 p-4 text-sm">
              <InfoRow label="Cliente" value={parsedClosure.client || '—'} />
              <InfoRow label="N° OS" value={parsedClosure.osNumber || '—'} />
              <InfoRow label="Motivo" value={parsedClosure.reason || '—'} />
              <InfoRow
                label="Setor"
                value={sectorOptions.find((option) => option.value === sector)?.label || '—'}
              />
              <InfoRow label="Responsáveis" value={parsedClosure.contacts || '—'} />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Texto final
              </label>
              <textarea
                readOnly
                value={generatedText}
                placeholder="O texto gerado vai aparecer aqui."
                className="min-h-72 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
              />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'ANTICIPATION' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Regional
                </label>
                <select
                  value={anticipationRegional}
                  onChange={(e) => setAnticipationRegional(e.target.value as Regional)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={Regional.DF02}>DF02</option>
                  <option value={Regional.DF03}>DF03</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Dados do cliente e OS
                </label>
                <textarea
                  value={anticipationInput}
                  onChange={(e) => setAnticipationInput(e.target.value)}
                  placeholder="N° OS: 010626112225235402 | (588672) GIOVANNA OLIVEIRA SOUSA SILVA"
                  className="min-h-32 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
                <InfoRow label="Cliente identificado" value={parsedAnticipation.client || '—'} />
                <div className="mt-3">
                  <InfoRow label="O.S. identificada" value={parsedAnticipation.osNumber || '—'} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddAnticipation}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Adicionar à lista
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(anticipationText, setAnticipationFeedback)}
                  disabled={anticipationItems.length === 0}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={handleClearAnticipation}
                  disabled={anticipationItems.length === 0 && !anticipationInput}
                  className="rounded-xl border border-red-900/60 px-5 py-2.5 text-sm font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Limpar
                </button>
                {anticipationFeedback && (
                  <span className="text-sm text-green-400">{anticipationFeedback}</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-400">
              Texto acumulado
            </h3>
            <div className="mt-4">
              <textarea
                readOnly
                value={anticipationText}
                placeholder="As antecipações adicionadas vão aparecer aqui."
                className="min-h-96 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
              />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'NONCONFORMITY' && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Dados da OS e cliente
                </label>
                <textarea
                  value={nonconformityServiceInfo}
                  onChange={(e) => setNonconformityServiceInfo(e.target.value)}
                  placeholder="N° OS: 010626112204041849 | (592124) MARIANA CASTILHO DE FREITAS"
                  className="min-h-28 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Regional
                  </label>
                  <select
                    value={nonconformityRegional}
                    onChange={(e) => setNonconformityRegional(e.target.value as Regional)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={Regional.DF02}>DF02</option>
                    <option value={Regional.DF03}>DF03</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Setor que abriu a O.S.
                  </label>
                  <select
                    value={nonconformitySector}
                    onChange={(e) => setNonconformitySector(e.target.value as SectorKey)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sectorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                  Erro encontrado
                </label>
                <textarea
                  value={nonconformityError}
                  onChange={(e) => setNonconformityError(e.target.value)}
                  placeholder="O.S. foi aberta no dia 22/04 às 20:40, com agendamento na carga do técnico para o mesmo dia."
                  className="min-h-36 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateNonconformity}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Gerar texto
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(nonconformityText, setNonconformityFeedback)}
                  disabled={!nonconformityText}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copiar
                </button>
                {nonconformityFeedback && (
                  <span className="text-sm text-green-400">{nonconformityFeedback}</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-400">
              Prévia
            </h3>

            <div className="mt-4 grid gap-3 rounded-xl border border-gray-800 bg-gray-950/80 p-4 text-sm">
              <InfoRow label="Cliente" value={parsedNonconformity.client || '—'} />
              <InfoRow label="O.S." value={parsedNonconformity.osNumber || '—'} />
              <InfoRow label="Regional" value={nonconformityRegional} />
              <InfoRow label="Setor" value={parsedNonconformity.sectorLabel || '—'} />
              <InfoRow label="Erro encontrado" value={nonconformityError || '—'} />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Texto final
              </label>
              <textarea
                readOnly
                value={nonconformityText}
                placeholder="O texto da inconformidade vai aparecer aqui."
                className="min-h-72 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</span>
      <p className="mt-1 break-words text-sm text-white">{value}</p>
    </div>
  );
}
