'use client';

import { createContext, useContext } from 'react';

/* Ações do quadro que os cards podem disparar sem receber props de cada
   coluna: mover um card (técnico ou dupla) pelo menu "Mover", que usa o mesmo
   caminho de gravação do arrastar, e marcar cards no modo seleção. */

export interface MoveTarget {
  id: string;
  name: string;
  count: number;
  isAbsent: boolean;
  isCurrent: boolean;
}

export interface BoardActions {
  getMoveTargets: (cellId: string) => MoveTarget[];
  moveCell: (cellId: string, targetCityId: string) => void;
  /** Modo seleção do quadro: o card inteiro vira alvo de clique para marcar. */
  selection: {
    active: boolean;
    isSelected: (cellId: string) => boolean;
    toggle: (cellId: string) => void;
  };
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

/** `null` fora do quadro (ex.: o card "fantasma" que segue o mouse no arrastar). */
export function useBoardActions() {
  return useContext(BoardActionsContext);
}
