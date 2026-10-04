'use client';

import { createContext, useContext } from 'react';

/* Ações do quadro que os cards podem disparar sem receber props de cada
   coluna. Hoje: mover um card (técnico ou dupla) para outra cidade ou para
   Ausente pelo menu "Mover", que usa o mesmo caminho de gravação do arrastar. */

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
}

export const BoardActionsContext = createContext<BoardActions | null>(null);

/** `null` fora do quadro (ex.: o card "fantasma" que segue o mouse no arrastar). */
export function useBoardActions() {
  return useContext(BoardActionsContext);
}
