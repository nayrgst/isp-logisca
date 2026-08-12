/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sem `experimental.serverActions.allowedOrigins` de propósito: o Next já
  // aceita Server Actions same-origin, então dev (localhost:3000) e produção
  // funcionam sem configuração. A lista serve só para origens EXTRA (proxy
  // reverso) — listar localhost aqui liberaria a máquina de qualquer dev para
  // disparar Server Actions cross-origin contra produção.
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
