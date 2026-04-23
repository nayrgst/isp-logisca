'use client';

import { useMemo, useState } from 'react';

type ClosureType = 'DELIVERY' | 'FIELD';
type SectorKey = 'COMERCIAL_INTERNO' | 'CRM' | 'REVENDA' | 'ASR' | 'MUNDIALE' | 'PME';

const sectorOptions: Array<{ value: SectorKey; label: string; contacts: string }> = [
  { value: 'COMERCIAL_INTERNO', label: 'Comercial interno', contacts: 'Brendo e Darlan' },
  { value: 'CRM', label: 'CRM', contacts: 'CRM' },
  { value: 'REVENDA', label: 'Revenda', contacts: 'Evelyn Wagner' },
  { value: 'ASR', label: 'ASR', contacts: 'Dennis' },
  { value: 'MUNDIALE', label: 'Mundiale', contacts: 'Brendo' },
  { value: 'PME', label: 'PME', contacts: 'Ana Beatriz, Daiana e Luiz Eduardo' },
];

function extractOs(rawServiceInfo: string, rawTechnicianMessage: string) {
  const combined = `${rawServiceInfo}\n${rawTechnicianMessage}`;
  const match = combined.match(/N[°ºo]?\s*OS:\s*([0-9]+)/i) ?? combined.match(/\b([0-9]{12,})\b/);
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

export function ClosurePanel() {
  const [serviceInfo, setServiceInfo] = useState('');
  const [technicianMessage, setTechnicianMessage] = useState('');
  const [sector, setSector] = useState<SectorKey>('COMERCIAL_INTERNO');
  const [closureType, setClosureType] = useState<ClosureType>('DELIVERY');
  const [generatedText, setGeneratedText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const parsed = useMemo(() => {
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

  function handleGenerate() {
    setGeneratedText(
      buildClosureText({
        osNumber: parsed.osNumber,
        client: parsed.client,
        reason: parsed.reason,
        type: closureType,
        contacts: parsed.contacts,
      })
    );
    setCopyFeedback('');
  }

  async function handleCopy() {
    if (!generatedText) return;

    try {
      await navigator.clipboard.writeText(generatedText);
      setCopyFeedback('Texto copiado!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Não foi possível copiar.');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Encerramento de OS</h2>
        <p className="mt-1 text-sm text-gray-400">
          Cole os dados da OS e a mensagem do técnico para gerar o texto pronto do WhatsApp.
        </p>
      </div>

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
                onClick={handleGenerate}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Gerar texto
              </button>
              <button
                onClick={handleCopy}
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
            <InfoRow label="Cliente" value={parsed.client || '—'} />
            <InfoRow label="N° OS" value={parsed.osNumber || '—'} />
            <InfoRow label="Motivo" value={parsed.reason || '—'} />
            <InfoRow label="Setor" value={sectorOptions.find((option) => option.value === sector)?.label || '—'} />
            <InfoRow label="Responsáveis" value={parsed.contacts || '—'} />
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
