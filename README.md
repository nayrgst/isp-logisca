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
- Dashboard em formato Kanban por cidade, com planejamento por data (cada dia
  guarda a propria lotacao, duplas, apoio e OS)
- Coluna `Ausente`, agrupada por motivo (ferias, folga, atestado, carro quebrado...)
- Filtros `Todos`, `MEI` e `CLT`, busca por nome/codigo
- OS por tipo: Field, Delivery, Retirada, Liberacao de porta e Interno
- Duplas de tecnicos (a dupla atende toda operacao que pelo menos um dos dois tem)
- Apoio em Serra Dourada e sub-areas da Area Verde (DF02)
- Drag and drop entre cidades
- `Copiar carga`: texto pronto do dia, com o motivo de quem esta ausente
- Central de Textos: encerramento, antecipacao e inconformidade
- Painel ADM para:
  - criar e remover tecnicos
  - criar e remover cidades
  - editar nome, codigo, lotacao padrao, dupla padrao e operacoes do tecnico
  - editar limite de OS
  - zerar as OS de hoje da regional
- Codigo do tecnico opcional na interface

A lotacao e a dupla do Painel ADM sao o padrao do tecnico, usado nos dias que
ainda nao foram mexidos no quadro. O que se muda no quadro vale so para aquele dia.

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

`NEXTAUTH_URL` so e usado fora da Vercel. Na Vercel o next-auth ignora essa
variavel e deriva a origem do header `x-forwarded-host` (porque `VERCEL` esta
sempre setado no ambiente), entao nao ha nada para configurar. Em VPS/Docker
ela e obrigatoria e precisa ser a URL publica real:

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

## Deploy (Vercel)

Producao roda na Vercel em `isp-logisca.vercel.app`. O deploy dispara sozinho a
cada push na `main`.

Variaveis a configurar no painel do projeto (Settings -> Environment Variables):

1. `DATABASE_URL` — Postgres (Neon)
2. `NEXTAUTH_SECRET` — segredo de assinatura do JWT

`NEXTAUTH_URL` nao e necessario aqui (ver secao de variaveis acima).

> **Nao** defina `NODE_ENV=production` como variavel de ambiente do projeto.
> A Vercel ja cuida disso no build, e setar manualmente faz o `npm install`
> pular as `devDependencies` (tailwind, typescript, eslint-config-next), o que
> quebra o build inteiro.

Antes de dar push, rodar localmente:

```bash
node_modules/.bin/tsc --noEmit && node_modules/.bin/eslint src && node_modules/.bin/next build
```

## Exemplo de Deploy em VPS (alternativo)

Fora da Vercel, `NEXTAUTH_URL` passa a ser obrigatorio:

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
