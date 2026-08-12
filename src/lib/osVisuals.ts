/* Fonte única das cores por tipo de OS. Antes esse mapa existia duplicado em
   três lugares (OSField, StatDot do CityColumn e a barra de progresso do card),
   o que deixava as cores livres para divergirem entre si. */

export type OSVisualKey = 'field' | 'delivery' | 'pickup' | 'door' | 'internal';

export interface OSVisual {
  key: OSVisualKey;
  /** Rótulo curto, usado no resumo da coluna. */
  short: string;
  /** Rótulo completo, usado no card do técnico. */
  label: string;
  /** Classe de cor de texto. */
  text: string;
  /** Classe de cor de fundo sólido (pontos, barras). */
  solid: string;
  /** Fundo tênue do bloco. */
  surface: string;
  /** Borda do bloco. */
  border: string;
}

export const OS_VISUALS: Record<OSVisualKey, OSVisual> = {
  field: {
    key: 'field',
    short: 'Field',
    label: 'Field',
    text: 'text-os-field',
    solid: 'bg-os-field',
    surface: 'bg-os-field/8',
    border: 'border-os-field/25',
  },
  delivery: {
    key: 'delivery',
    short: 'Del',
    label: 'Delivery',
    text: 'text-os-delivery',
    solid: 'bg-os-delivery',
    surface: 'bg-os-delivery/8',
    border: 'border-os-delivery/25',
  },
  pickup: {
    key: 'pickup',
    short: 'Ret',
    label: 'Retirada',
    text: 'text-os-pickup',
    solid: 'bg-os-pickup',
    surface: 'bg-os-pickup/8',
    border: 'border-os-pickup/25',
  },
  door: {
    key: 'door',
    short: 'Porta',
    label: 'Lib. porta',
    text: 'text-os-door',
    solid: 'bg-os-door',
    surface: 'bg-os-door/8',
    border: 'border-os-door/25',
  },
  internal: {
    key: 'internal',
    short: 'Int',
    label: 'Interno',
    text: 'text-os-internal',
    solid: 'bg-os-internal',
    surface: 'bg-os-internal/8',
    border: 'border-os-internal/25',
  },
};

export const OS_VISUAL_ORDER: OSVisualKey[] = ['field', 'delivery', 'pickup', 'door', 'internal'];
