import { PrismaClient, Role, Regional, TechnicianType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpar dados existentes
  await prisma.technician.deleteMany();
  await prisma.city.deleteMany();
  await prisma.user.deleteMany();

  // Criar usuários
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.createMany({
    data: [
      {
        email: 'supervisor.df02@isp.com',
        password: hashedPassword,
        name: 'Supervisor DF02',
        role: Role.SUPERVISOR,
        regional: Regional.DF02,
      },
      {
        email: 'supervisor.df03@isp.com',
        password: hashedPassword,
        name: 'Supervisor DF03',
        role: Role.SUPERVISOR,
        regional: Regional.DF03,
      },
      {
        email: 'operacional.df02@isp.com',
        password: hashedPassword,
        name: 'Operacional DF02',
        role: Role.OPERATIONAL,
        regional: Regional.DF02,
      },
      {
        email: 'operacional.df03@isp.com',
        password: hashedPassword,
        name: 'Operacional DF03',
        role: Role.OPERATIONAL,
        regional: Regional.DF03,
      },
    ],
  });

  // Criar cidades para DF02
  await prisma.city.createMany({
    data: [
      { name: 'Brasília', regional: Regional.DF02, order: 0 },
      { name: 'Taguatinga', regional: Regional.DF02, order: 1 },
      { name: 'Ceilândia', regional: Regional.DF02, order: 2 },
      { name: 'Samambaia', regional: Regional.DF02, order: 3 },
      { name: 'Águas Claras', regional: Regional.DF02, order: 4 },
    ],
  });

  // Criar cidades para DF03
  await prisma.city.createMany({
    data: [
      { name: 'Gama', regional: Regional.DF03, order: 0 },
      { name: 'Santa Maria', regional: Regional.DF03, order: 1 },
      { name: 'Recanto das Emas', regional: Regional.DF03, order: 2 },
      { name: 'Riacho Fundo', regional: Regional.DF03, order: 3 },
      { name: 'Núcleo Bandeirante', regional: Regional.DF03, order: 4 },
    ],
  });

  // Buscar cidades criadas
  const brasilia = await prisma.city.findFirst({ where: { name: 'Brasília' } });
  const taguatinga = await prisma.city.findFirst({ where: { name: 'Taguatinga' } });
  const ceilandia = await prisma.city.findFirst({ where: { name: 'Ceilândia' } });
  const gama = await prisma.city.findFirst({ where: { name: 'Gama' } });
  const santaMaria = await prisma.city.findFirst({ where: { name: 'Santa Maria' } });

  // Criar técnicos de exemplo - DF02
  await prisma.technician.createMany({
    data: [
      {
        code: '501',
        name: 'Carlos Silva',
        type: TechnicianType.CLT,
        regional: Regional.DF02,
        cityId: brasilia?.id,
        osLimit: 12,
      },
      {
        code: '502',
        name: 'Ana Souza',
        type: TechnicianType.CLT,
        regional: Regional.DF02,
        cityId: brasilia?.id,
        osLimit: 10,
      },
      {
        code: '503',
        name: 'Pedro Lima',
        type: TechnicianType.TER,
        regional: Regional.DF02,
        cityId: taguatinga?.id,
        osLimit: 8,
      },
      {
        code: '504',
        name: 'Lucas Alves',
        type: TechnicianType.CLT,
        regional: Regional.DF02,
        cityId: taguatinga?.id,
        osLimit: 10,
      },
      {
        code: '505',
        name: 'Maria Ferreira',
        type: TechnicianType.TER,
        regional: Regional.DF02,
        cityId: ceilandia?.id,
        osLimit: 8,
      },
    ],
  });

  // Criar técnicos de exemplo - DF03
  await prisma.technician.createMany({
    data: [
      {
        code: '601',
        name: 'João Oliveira',
        type: TechnicianType.CLT,
        regional: Regional.DF03,
        cityId: gama?.id,
        osLimit: 12,
      },
      {
        code: '602',
        name: 'Fernanda Costa',
        type: TechnicianType.TER,
        regional: Regional.DF03,
        cityId: santaMaria?.id,
        osLimit: 8,
      },
    ],
  });

  console.log('✅ Seed concluído!');
  console.log('\n📋 Usuários criados:');
  console.log('  supervisor.df02@isp.com / admin123 (Supervisor DF02)');
  console.log('  supervisor.df03@isp.com / admin123 (Supervisor DF03)');
  console.log('  operacional.df02@isp.com / admin123 (Operacional DF02)');
  console.log('  operacional.df03@isp.com / admin123 (Operacional DF03)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
