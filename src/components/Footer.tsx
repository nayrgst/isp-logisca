interface Props {
  /** Barra fina, para telas de altura fixa como o dashboard. */
  compact?: boolean;
}

const OWNER = 'nayrgst';

export function Footer({ compact = false }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`shrink-0 border-t border-line bg-canvas px-6 text-ink-subtle ${
        compact ? 'py-2' : 'py-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <p>
          © {year} {OWNER}. Todos os direitos reservados.
        </p>
        <p className="text-ink-subtle">ISP Logística · Gestão de Equipes Técnicas</p>
      </div>
    </footer>
  );
}
