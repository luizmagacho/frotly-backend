import * as mongoose from 'mongoose';

async function migrate() {
  await mongoose.connect('mongodb://localhost:27017/gestor-frota-pr');
  
  const Maintenance = mongoose.model('Maintenance', new mongoose.Schema({}, { strict: false }));
  const Rental = mongoose.model('Rental', new mongoose.Schema({}, { strict: false }));
  const FinancialEntry = mongoose.model('FinancialEntry', new mongoose.Schema({}, { strict: false, collection: 'financial_entries' }));

  const maintenances = await Maintenance.find({ status: 'COMPLETED', cost: { $gt: 0 } }).lean();
  for (const m of maintenances) {
    const existing = await FinancialEntry.findOne({ sourceId: (m as any)._id }).lean();
    if (!existing) {
      await FinancialEntry.create({
        tenantId: (m as any).tenantId,
        vehicleId: (m as any).vehicleId,
        type: 'EXPENSE',
        category: 'MANUTENCAO',
        status: 'PAID',
        amount: (m as any).cost,
        date: (m as any).completedDate || (m as any).scheduledDate,
        description: `Manutenção: ${(m as any).description}`,
        sourceId: (m as any)._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Migrated maintenance ${(m as any)._id}`);
    }
  }

  const rentals = await Rental.find({}).lean();
  for (const r of rentals) {
    for (const p of (r as any).payments || []) {
      if (p.status !== 'PAID') continue;
      const sourceId = p.id || p._id || (r as any)._id;
      const existing = await FinancialEntry.findOne({ sourceId }).lean();
      if (!existing) {
        await FinancialEntry.create({
          tenantId: (r as any).tenantId,
          vehicleId: (r as any).vehicleId,
          type: 'INCOME',
          category: 'ALUGUEL',
          status: 'PAID',
          amount: p.amount,
          date: p.paidAt || p.dueDate,
          description: 'Pagamento de aluguel',
          sourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`Migrated rental payment ${(r as any)._id}`);
      }
    }
  }

  console.log('Migration complete');
  process.exit(0);
}

migrate().catch(console.error);
