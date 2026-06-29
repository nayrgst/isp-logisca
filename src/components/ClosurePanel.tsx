'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ClosureAgent, Regional } from '@prisma/client';
import { registerClosure } from '@/app/actions/closure';
import { AGENT_VALUES, agentLabels, type ClosureCounts } from '@/lib/closure';
import { formatDateKeyBR } from '@/lib/schedule';

type ToolTab = 'CLOSURE' | 'ANTICIPATION' | 'NONCONFORMITY';
type ClosureType = 'DELIVERY' | 'FIELD';
type SectorKey =
  | 'COMERCIAL_INTERNO'
  | 'CRM'
  | 'REVENDA'
  | 'ASR'
  | 'MUNDIALE'
  | 'UPGRADE'
  | 'PME'
  | 'PAP';

const sectorOptions: Array<{ value: SectorKey; label: string; contacts: string }> = [
  { value: 'COMERCIAL_INTERNO', label: 'Comercial interno', contacts: 'Clarice Brendo Darlan' },
  { value: 'CRM', label: 'CRM', contacts: 'CRM' },
  { value: 'REVENDA', label: 'Revenda', contacts: 'Evelyn Wagner' },
  { value: 'ASR', label: 'ASR', contacts: 'Dennis' },
  { value: 'MUNDIALE', label: 'Mundiale', contacts: 'Clarice Brendo Darlan Geovanna' },
  { value: 'UPGRADE', label: 'Upgrade', contacts: 'Yasmin Clarice Gleisson' },
  { value: 'PME', label: 'PME', contacts: 'Ana Daiana Luiz' },
  { value: 'PAP', label: 'PAP', contacts: 'Karen Safyra Rosana Ferreira' },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function extractOs(rawServiceInfo: string, rawTechnicianMessage = '') {
  const combined = `${rawServiceInfo}\n${rawTechnicianMessage}`;
  const patterns = [
    /N[º°o]?\s*[.:]?\s*OS\s*[.:]?\s*([\d.\-/\s]{6,})/i, // "Nº OS: 010..."
    /\bOS\s*[nN][º°o]?\s*[.:]?\s*([\d.\-/\s]{6,})/i, // "OS nº 010..."
    /ordem\s+de\s+servi[çc]o[^\d]{0,30}?([\d.\-/\s]{6,})/i, // "ordem de serviço ... número 010..."
    /\b(\d[\d.\-/\s]{10,}\d)\b/, // fallback: sequência longa de dígitos
  ];

  for (const pattern of patterns) {
    const digits = onlyDigits(combined.match(pattern)?.[1] ?? '');
    if (digits.length >= 6) return digits;
  }

  return '';
}

function cleanName(name: string) {
  return name
    .replace(/\(\d+\)/g, '') // remove código entre parênteses
    .replace(/\b\d{6,}\b/g, '') // remove sequências longas (OS/código colados)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseClient(rawServiceInfo: string): { code: string; name: string } {
  const text = rawServiceInfo.trim();
  if (!text) return { code: '', name: '' };

  // 1) Código entre parênteses: "(292604) NOME DO CLIENTE"
  const paren = text.match(/\((\d+)\)\s*([^\n|]+)/);
  if (paren) {
    return { code: paren[1], name: cleanName(paren[2]) };
  }

  // 2) Formato com barra: "... | NOME" (ou "| CÓDIGO NOME")
  const pipeIndex = text.indexOf('|');
  if (pipeIndex >= 0) {
    const afterPipe = text.slice(pipeIndex + 1).trim();
    if (afterPipe) {
      const withCode = afterPipe.match(/^(\d{1,11})\s+(.+)$/);
      if (withCode) return { code: withCode[1], name: cleanName(withCode[2]) };
      return { code: '', name: cleanName(afterPipe) };
    }
  }

  // 3) Formato colunar: "CÓDIGO  NOME  Nº OS"
  // 3a) Linha única ancorada (código curto + nome + OS longa), com TAB ou espaços
  const single = text.match(/^(\d{1,11})[\t ]+(.+?)[\t ]+\d[\d.\-/\s]{10,}\d\s*$/);
  if (single) {
    return { code: single[1], name: cleanName(single[2]) };
  }

  // 3b) Demais casos colunares (TAB de preferência; senão 2+ espaços)
  const tokens = (text.includes('\t') ? text.split('\t') : text.split(/\s{2,}/))
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length >= 2) {
    let code = '';
    let name = '';

    for (const token of tokens) {
      const digits = onlyDigits(token);
      const hasLetters = /[A-Za-zÀ-ÿ]/.test(token);

      if (hasLetters && !name) {
        name = cleanName(token);
      } else if (!hasLetters && digits.length >= 1 && digits.length < 12 && !code) {
        code = digits; // código curto (a OS tem 12+ dígitos e é ignorada aqui)
      }
    }

    if (name || code) return { code, name };
  }

  return { code: '', name: '' };
}

function extractClient(rawServiceInfo: string) {
  const { code, name } = parseClient(rawServiceInfo);
  if (code && name) return `(${code}) ${name}`;
  return name;
}

function extractClientCode(rawServiceInfo: string) {
  return parseClient(rawServiceInfo).code;
}

function extractClientName(rawServiceInfo: string) {
  return parseClient(rawServiceInfo).name;
}

function buildSpreadsheetText(params: {
  closureDate: string;
  clientCode: string;
  clientName: string;
  osNumber: string;
  regional: Regional;
  agent: ClosureAgent;
}) {
  return [
    formatDateKeyBR(params.closureDate),
    params.clientCode,
    params.clientName,
    params.osNumber,
    params.regional,
    agentLabels[params.agent],
  ].join('\t');
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

function buildAnticipationText(
  regional: Regional,
  items: Array<{ client: string; osNumber: string }>
) {
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

type ClosurePanelProps = {
  initialCounts: ClosureCounts;
  monthLabel: string;
  todayDateKey: string;
  defaultRegional: Regional;
};

export function ClosurePanel({
  initialCounts,
  monthLabel,
  todayDateKey,
  defaultRegional,
}: ClosurePanelProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>('CLOSURE');

  const [serviceInfo, setServiceInfo] = useState('');
  const [technicianMessage, setTechnicianMessage] = useState('');
  const [sector, setSector] = useState<SectorKey>('COMERCIAL_INTERNO');
  const [closureType, setClosureType] = useState<ClosureType>('DELIVERY');
  const [generatedText, setGeneratedText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const [closureDate, setClosureDate] = useState(todayDateKey);
  const [closureAgent, setClosureAgent] = useState<ClosureAgent>(ClosureAgent.RYAN);
  const [closureRegional, setClosureRegional] = useState<Regional>(defaultRegional);
  const [registerFeedback, setRegisterFeedback] = useState('');
  const [agentCounts, setAgentCounts] = useState<ClosureCounts>(initialCounts);
  const [isRegistering, startRegister] = useTransition();

  const [anticipationRegional, setAnticipationRegional] = useState<Regional>(Regional.DF02);
  const [anticipationInput, setAnticipationInput] = useState('');
  const [anticipationItems, setAnticipationItems] = useState<
    Array<{ client: string; osNumber: string }>
  >([]);
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
      sectorLabel:
        sectorOptions.find((option) => option.value === nonconformitySector)?.label ?? '',
    }),
    [nonconformitySector, nonconformityServiceInfo]
  );

  const anticipationText = useMemo(
    () => buildAnticipationText(anticipationRegional, anticipationItems),
    [anticipationItems, anticipationRegional]
  );

  const spreadsheetParts = useMemo(
    () => ({
      clientCode: extractClientCode(serviceInfo),
      clientName: extractClientName(serviceInfo),
      osNumber: parsedClosure.osNumber,
    }),
    [parsedClosure.osNumber, serviceInfo]
  );

  const spreadsheetText = useMemo(
    () =>
      buildSpreadsheetText({
        closureDate,
        clientCode: spreadsheetParts.clientCode,
        clientName: spreadsheetParts.clientName,
        osNumber: spreadsheetParts.osNumber,
        regional: closureRegional,
        agent: closureAgent,
      }),
    [closureAgent, closureDate, closureRegional, spreadsheetParts]
  );

  const feedbackTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function clearFeedback(setter: (value: string) => void, delay = 2000) {
    const timer = window.setTimeout(() => setter(''), delay);
    feedbackTimers.current.push(timer);
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

  function handleRegisterClosure() {
    if (!closureDate) {
      setRegisterFeedback('Informe a data do encerramento.');
      clearFeedback(setRegisterFeedback, 2500);
      return;
    }

    startRegister(async () => {
      try {
        const summary = await registerClosure({
          agent: closureAgent,
          regional: closureRegional,
          closureDate,
          clientCode: spreadsheetParts.clientCode,
          clientName: spreadsheetParts.clientName,
          osNumber: spreadsheetParts.osNumber,
        });
        setAgentCounts(summary.counts);

        try {
          await navigator.clipboard.writeText(spreadsheetText);
          setRegisterFeedback('Encerramento registrado e texto copiado!');
        } catch {
          setRegisterFeedback('Registrado! (não foi possível copiar o texto)');
        }
        clearFeedback(setRegisterFeedback, 3000);
      } catch (error) {
        setRegisterFeedback(
          error instanceof Error ? error.message : 'Não foi possível registrar.'
        );
        clearFeedback(setRegisterFeedback, 3000);
      }
    });
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
        <p className="mt-1 text-sm text-slate-400">
          Gere rapidamente textos operacionais de encerramento, antecipação e inconformidade.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
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
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'CLOSURE' && (
        <div className="flex flex-col gap-6">
          <MonthlyClosureCounter monthLabel={monthLabel} counts={agentCounts} />

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="closure-service-info"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Dados da OS e cliente
                </label>
                <textarea
                  id="closure-service-info"
                  value={serviceInfo}
                  onChange={(e) => setServiceInfo(e.target.value)}
                  placeholder="N° OS: 010626070163839586 | (292604) GUILHERME HENRIQUE BARBOSA"
                  className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="closure-technician-message"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Mensagem do técnico
                </label>
                <textarea
                  id="closure-technician-message"
                  value={technicianMessage}
                  onChange={(e) => setTechnicianMessage(e.target.value)}
                  placeholder="A ordem de serviço de número 010626070163839586..."
                  className="min-h-40 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="closure-sector"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Setor responsável
                  </label>
                  <select
                    id="closure-sector"
                    value={sector}
                    onChange={(e) => setSector(e.target.value as SectorKey)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {sectorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="closure-type"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Tipo de encerramento
                  </label>
                  <select
                    id="closure-type"
                    value={closureType}
                    onChange={(e) => setClosureType(e.target.value as ClosureType)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Gerar texto
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedText, setCopyFeedback)}
                  disabled={!generatedText}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copiar
                </button>
                {copyFeedback && <span className="text-sm text-green-400">{copyFeedback}</span>}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Prévia
            </h3>

            <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm">
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
              <label
                htmlFor="closure-final-text"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
              >
                Texto final
              </label>
              <textarea
                id="closure-final-text"
                readOnly
                value={generatedText}
                placeholder="O texto gerado vai aparecer aqui."
                className="min-h-72 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              />
            </div>
          </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Registro para planilha
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Usa os dados da OS/cliente acima. Preencha data, agente e regional e clique em
                registrar.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="closure-date"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Data
                  </label>
                  <input
                    id="closure-date"
                    type="date"
                    value={closureDate}
                    onChange={(e) => setClosureDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="closure-agent"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Agente
                  </label>
                  <select
                    id="closure-agent"
                    value={closureAgent}
                    onChange={(e) => setClosureAgent(e.target.value as ClosureAgent)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {AGENT_VALUES.map((agent) => (
                      <option key={agent} value={agent}>
                        {agentLabels[agent]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="closure-regional"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Regional
                  </label>
                  <select
                    id="closure-regional"
                    value={closureRegional}
                    onChange={(e) => setClosureRegional(e.target.value as Regional)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={Regional.DF02}>DF02</option>
                    <option value={Regional.DF03}>DF03</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRegisterClosure}
                  disabled={isRegistering}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRegistering ? 'Registrando...' : 'Registrar encerramento'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(spreadsheetText, setRegisterFeedback)}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                >
                  Copiar sem registrar
                </button>
                {registerFeedback && (
                  <span className="text-sm text-green-400">{registerFeedback}</span>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Prévia da planilha
              </h3>

              <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm">
                <InfoRow label="Data" value={formatDateKeyBR(closureDate)} />
                <InfoRow label="Código" value={spreadsheetParts.clientCode || '—'} />
                <InfoRow label="Cliente" value={spreadsheetParts.clientName || '—'} />
                <InfoRow label="N° OS" value={spreadsheetParts.osNumber || '—'} />
                <InfoRow label="Regional" value={closureRegional} />
                <InfoRow label="Agente" value={agentLabels[closureAgent]} />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="closure-spreadsheet-text"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Texto (separado por TAB) para colar na planilha
                </label>
                <textarea
                  id="closure-spreadsheet-text"
                  readOnly
                  value={spreadsheetText}
                  className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 focus:outline-none"
                />
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'ANTICIPATION' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="anticipation-regional"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Regional
                </label>
                <select
                  id="anticipation-regional"
                  value={anticipationRegional}
                  onChange={(e) => setAnticipationRegional(e.target.value as Regional)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={Regional.DF02}>DF02</option>
                  <option value={Regional.DF03}>DF03</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="anticipation-input"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Dados do cliente e OS
                </label>
                <textarea
                  id="anticipation-input"
                  value={anticipationInput}
                  onChange={(e) => setAnticipationInput(e.target.value)}
                  placeholder="N° OS: 010626112225235402 | (588672) GIOVANNA OLIVEIRA SOUSA SILVA"
                  className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <InfoRow label="Cliente identificado" value={parsedAnticipation.client || '—'} />
                <div className="mt-3">
                  <InfoRow label="O.S. identificada" value={parsedAnticipation.osNumber || '—'} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddAnticipation}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Adicionar à lista
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(anticipationText, setAnticipationFeedback)}
                  disabled={anticipationItems.length === 0}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Texto acumulado
            </h3>

            {anticipationItems.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {anticipationItems.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-200">
                      {item.client || 'Sem cliente'} · OS {item.osNumber || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAnticipationItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      className="shrink-0 text-slate-500 transition-colors hover:text-red-400"
                      aria-label={`Remover ${item.client || 'item'}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              <textarea
                readOnly
                value={anticipationText}
                placeholder="As antecipações adicionadas vão aparecer aqui."
                className="min-h-96 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'NONCONFORMITY' && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="nonconformity-service-info"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Dados da OS e cliente
                </label>
                <textarea
                  id="nonconformity-service-info"
                  value={nonconformityServiceInfo}
                  onChange={(e) => setNonconformityServiceInfo(e.target.value)}
                  placeholder="N° OS: 010626112204041849 | (592124) MARIANA CASTILHO DE FREITAS"
                  className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="nonconformity-regional"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Regional
                  </label>
                  <select
                    id="nonconformity-regional"
                    value={nonconformityRegional}
                    onChange={(e) => setNonconformityRegional(e.target.value as Regional)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={Regional.DF02}>DF02</option>
                    <option value={Regional.DF03}>DF03</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="nonconformity-sector"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Setor que abriu a O.S.
                  </label>
                  <select
                    id="nonconformity-sector"
                    value={nonconformitySector}
                    onChange={(e) => setNonconformitySector(e.target.value as SectorKey)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <label
                  htmlFor="nonconformity-error"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Erro encontrado
                </label>
                <textarea
                  id="nonconformity-error"
                  value={nonconformityError}
                  onChange={(e) => setNonconformityError(e.target.value)}
                  placeholder="O.S. foi aberta no dia 22/04 às 20:40, com agendamento na carga do técnico para o mesmo dia."
                  className="min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateNonconformity}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Gerar texto
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(nonconformityText, setNonconformityFeedback)}
                  disabled={!nonconformityText}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copiar
                </button>
                {nonconformityFeedback && (
                  <span className="text-sm text-green-400">{nonconformityFeedback}</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Prévia
            </h3>

            <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm">
              <InfoRow label="Cliente" value={parsedNonconformity.client || '—'} />
              <InfoRow label="O.S." value={parsedNonconformity.osNumber || '—'} />
              <InfoRow label="Regional" value={nonconformityRegional} />
              <InfoRow label="Setor" value={parsedNonconformity.sectorLabel || '—'} />
              <InfoRow label="Erro encontrado" value={nonconformityError || '—'} />
            </div>

            <div className="mt-4">
              <label
                htmlFor="nonconformity-final-text"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
              >
                Texto final
              </label>
              <textarea
                id="nonconformity-final-text"
                readOnly
                value={nonconformityText}
                placeholder="O texto da inconformidade vai aparecer aqui."
                className="min-h-72 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
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
      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <p className="mt-1 wrap-break-word text-sm text-white">{value}</p>
    </div>
  );
}

function MonthlyClosureCounter({
  monthLabel,
  counts,
}: {
  monthLabel: string;
  counts: ClosureCounts;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          OS encerradas no mês
        </h3>
        <span className="text-xs capitalize text-slate-500">{monthLabel}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AGENT_VALUES.map((agent) => (
          <div
            key={agent}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-center"
          >
            <p className="text-2xl font-bold text-white">{counts[agent] ?? 0}</p>
            <p className="mt-0.5 text-xs text-slate-400">{agentLabels[agent]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
