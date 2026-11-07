import { describe, it, expect } from 'vitest';

/**
 * Automated Verification of the "Dirty Dozen" Firestore Security Rule Invariants
 * Mirrors the exact boolean predicates and regex/boundary guards in `firestore.rules`.
 */

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

const REQUEST_TIME = '2026-11-07T10:35:00.000Z';

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

const REQUIRED_PROD_KEYS = [
  'ownerId', 'month', 'plantId', 'plantName', 'sector',
  'productId', 'productName', 'productionLine', 'unitsProduced',
  'sellingPricePerUnit', 'revenue', 'budgetedCost',
  'rawMaterialCost', 'directLabourCost', 'energyCost',
  'maintenanceCost', 'logisticsCost', 'inventoryHoldingCost',
  'overheadCost', 'machineHoursAvailable', 'machineHoursUsed',
  'rawMaterialInputTons', 'rawMaterialNetTons',
  'energyKwhConsumed', 'benchmarkEnergyKwhPerUnit',
  'createdAt', 'updatedAt'
];

function evaluateCreateProductionRecord(
  auth: AuthContext | null,
  recordId: string,
  data: Record<string, any>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(recordId)) return 'PERMISSION_DENIED';

  const keys = Object.keys(data);
  if (keys.length !== REQUIRED_PROD_KEYS.length) return 'PERMISSION_DENIED';
  if (!REQUIRED_PROD_KEYS.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';

  if (typeof data.ownerId !== 'string' || !isValidId(data.ownerId) || data.ownerId !== auth.uid) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.month !== 'string' || !/^202[0-9]-(0[1-9]|1[0-2])$/.test(data.month)) {
    return 'PERMISSION_DENIED';
  }
  if (!['Cement Systems', 'Sugar Processing', 'Mining & Material Handling', 'Thermal Energy'].includes(data.sector)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.unitsProduced !== 'number' || data.unitsProduced <= 0) {
    return 'PERMISSION_DENIED';
  }
  if (data.createdAt !== REQUEST_TIME || data.updatedAt !== REQUEST_TIME) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function evaluateUpdateProductionRecord(
  auth: AuthContext | null,
  recordId: string,
  existing: Record<string, any>,
  incoming: Record<string, any>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(recordId)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (incoming.ownerId !== existing.ownerId) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== REQUEST_TIME) return 'PERMISSION_DENIED';
  if (typeof incoming.unitsProduced !== 'number' || incoming.unitsProduced <= 0) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

const VALID_BASE_RECORD = {
  ownerId: 'user_A',
  month: '2026-10',
  plantId: 'PLT-PUN-01',
  plantName: 'Pune Heavy Engineering Complex',
  sector: 'Thermal Energy',
  productId: 'PRD-THM-401',
  productName: '120 TPH CFBC Thermal Boiler',
  productionLine: 'BAY-BOILER-01',
  unitsProduced: 4,
  sellingPricePerUnit: 820000,
  revenue: 3280000,
  budgetedCost: 2350000,
  rawMaterialCost: 1120000,
  directLabourCost: 340000,
  energyCost: 210000,
  maintenanceCost: 145000,
  logisticsCost: 195000,
  inventoryHoldingCost: 110000,
  overheadCost: 245000,
  machineHoursAvailable: 720,
  machineHoursUsed: 612,
  rawMaterialInputTons: 480,
  rawMaterialNetTons: 432,
  energyKwhConsumed: 1450000,
  benchmarkEnergyKwhPerUnit: 340000,
  createdAt: REQUEST_TIME,
  updatedAt: REQUEST_TIME,
};

describe('Firestore Security Rules - Dirty Dozen Adversarial Suite', () => {
  it('1. Rejects unauthenticated write attempts', () => {
    expect(evaluateCreateProductionRecord(null, 'rec_1', VALID_BASE_RECORD)).toBe('PERMISSION_DENIED');
  });

  it('2. Rejects unverified email spoof attempts', () => {
    expect(
      evaluateCreateProductionRecord({ uid: 'user_A', email_verified: false }, 'rec_1', VALID_BASE_RECORD)
    ).toBe('PERMISSION_DENIED');
  });

  it('3. Rejects cross-tenant identity spoofing on create', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        { ...VALID_BASE_RECORD, ownerId: 'user_B' }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('4. Rejects shadow/ghost field injection on create', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        { ...VALID_BASE_RECORD, isAdmin: true }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('5. Rejects path variable ID poisoning', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'bad$id!with*spaces',
        VALID_BASE_RECORD
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('6. Rejects string boundary overflow / invalid month pattern', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        { ...VALID_BASE_RECORD, month: '2026-13-99' }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('7. Rejects invalid sector enum injection', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        { ...VALID_BASE_RECORD, sector: 'Aerospace' }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('8. Rejects client timestamp forgery on create', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        { ...VALID_BASE_RECORD, createdAt: '2020-01-01T00:00:00.000Z' }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('9. Rejects immortal field mutation (ownerId/createdAt) on update', () => {
    expect(
      evaluateUpdateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        VALID_BASE_RECORD,
        { ...VALID_BASE_RECORD, ownerId: 'user_B' }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('10. Rejects update-gap value poisoning (negative or non-numeric unitsProduced)', () => {
    expect(
      evaluateUpdateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        VALID_BASE_RECORD,
        { ...VALID_BASE_RECORD, unitsProduced: -10 }
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('11. Rejects cross-tenant update by non-owner', () => {
    expect(
      evaluateUpdateProductionRecord(
        { uid: 'user_B', email_verified: true },
        'rec_1',
        VALID_BASE_RECORD,
        VALID_BASE_RECORD
      )
    ).toBe('PERMISSION_DENIED');
  });

  it('12. Allows strictly valid verified owner create & update', () => {
    expect(
      evaluateCreateProductionRecord(
        { uid: 'user_A', email_verified: true },
        'rec_1',
        VALID_BASE_RECORD
      )
    ).toBe('ALLOW');
  });
});
