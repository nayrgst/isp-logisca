# ISP Logistica

Sistema web para gestao logistica de equipes tecnicas de ISP, com foco em distribuicao de tecnicos por cidade, controle de OS, operacao por regional e painel administrativo.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth.js
- dnd-kit

## Funcionalidades

- Login com perfis `SUPERVISOR` e `OPERATIONAL`
- Segregacao por regional `DF02` e `DF03`
- Dashboard em formato Kanban por cidade
- Coluna `Sem cidade` para tecnicos ainda nao alocados
- Filtros `Todos`, `Field` e `Delivery`
- Edicao segura de OS por tecnico
- Drag and drop entre cidades
- Painel ADM para:
  - criar e remover tecnicos
  - criar e remover cidades
  - editar nome de tecnicos
  - editar nome de cidades
  - editar limite de OS
  - zerar OS da regional
- Codigo do tecnico opcional na interface

## Requisitos

- Node `22.22.2`
- npm `9+`
- PostgreSQL acessivel pela aplicacao

O projeto usa `.nvmrc`, entao o ideal e carregar o Node via `nvm`.

## Variaveis de Ambiente

Crie ou ajuste o arquivo `.env` com pelo menos:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

Para producao, troque `NEXTAUTH_URL` pela URL real publicada:

```env
NEXTAUTH_URL="https://seu-dominio.com"
```

## Instalar Dependencias

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm use
npm install
```

## Desenvolvimento

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm use
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Build de Producao

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm use
npm run build
```

## Rodar em Producao

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm use
npm start
```

Por padrao, a aplicacao sobe em:

```text
http://localhost:3000
```

## Seed do Banco

Se quiser popular o banco com dados iniciais:

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm use
npx prisma db seed
```

Usuarios criados pelo seed:

- `supervisor.df02@isp.com`
- `supervisor.df03@isp.com`
- `operacional.df02@isp.com`
- `operacional.df03@isp.com`

Senha padrao:

```text
admin123
```

## Checklist de Deploy

Antes de publicar:

1. garantir que o servidor esta usando `Node 22.22.2`
2. configurar `DATABASE_URL`
3. configurar `NEXTAUTH_SECRET`
4. configurar `NEXTAUTH_URL` com a URL final
5. rodar `npm install`
6. rodar `npm run build`
7. iniciar com `npm start`

## Exemplo de Deploy em VPS

```bash
cd /home/nayr/isp-logistica
export NVM_DIR=~/.nvm
. ~/.nvm/nvm.sh
nvm install 22.22.2
nvm use 22.22.2
npm install
npm run build
npm start
```

## Estrutura Importante

- `src/app/dashboard/page.tsx`: dashboard principal
- `src/app/admin/page.tsx`: painel administrativo
- `src/app/actions/technician.ts`: acoes de tecnico
- `src/app/actions/city.ts`: acoes de cidade
- `src/proxy.ts`: protecao de rotas
- `prisma/schema.prisma`: modelagem do banco
- `prisma/seed.ts`: seed inicial

## Observacoes

- O projeto compila com sucesso em producao com `Node 22.22.2`
- O App Router esta em Next 16, entao mantenha esse ambiente alinhado ao `.nvmrc`
- O deploy self-hosted deve preferencialmente usar proxy reverso na frente do `next start`
