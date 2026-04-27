export type VacationType = 'Integrais' | 'Proporcionais' | 'Fracionadas';

export interface VacationReceiptData {
  companyId: string;
  companyName: string;
  companyDoc: string;
  employeeName: string;
  employeeCpf: string;
  role: string;
  registration: string;
  pis: string;
  department: string;
  acquisitionStart: string;
  acquisitionEnd: string;
  concessionStart: string;
  concessionEnd: string;
  leaveStart: string;
  leaveEnd: string;
  vacationDays: number;
  returnDate: string;
  vacationType: VacationType;
  fractionDescription: string;
  salaryBase: number;
  avgVariables: number;
  otherPayItems: number;
  abonoEnabled: boolean;
  abonoDays: number;
  discountsValue: number;
  discountsDesc: string;
  payMethod: string;
  payDate: string;
  signaturePlace: string;
  signatureDate: string;
  responsibleName: string;
  responsibleCpf: string;
  responsibleRole: string;
}

export interface VacationCalculationResult {
  baseRemuneration: number;
  vacationValue: number;
  oneThirdValue: number;
  abonoValue: number;
  abonoOneThirdValue: number;
  effectiveLeaveDays: number;
  grossTotal: number;
  netTotal: number;
}

export interface VacationHistoryItem extends VacationReceiptData, VacationCalculationResult {
  id: string;
  receiptId?: string;
  fileName?: string;
  createdAt: string;
}

export function createEmptyVacationReceiptData(): VacationReceiptData {
  const today = new Date().toISOString().split('T')[0];
  return {
    companyId: '',
    companyName: '',
    companyDoc: '',
    employeeName: '',
    employeeCpf: '',
    role: '',
    registration: '',
    pis: '',
    department: '',
    acquisitionStart: '',
    acquisitionEnd: '',
    concessionStart: '',
    concessionEnd: '',
    leaveStart: '',
    leaveEnd: '',
    vacationDays: 30,
    returnDate: '',
    vacationType: 'Integrais',
    fractionDescription: '',
    salaryBase: 0,
    avgVariables: 0,
    otherPayItems: 0,
    abonoEnabled: false,
    abonoDays: 0,
    discountsValue: 0,
    discountsDesc: '',
    payMethod: 'Depósito',
    payDate: today,
    signaturePlace: 'Monte Verde',
    signatureDate: today,
    responsibleName: '',
    responsibleCpf: '',
    responsibleRole: '',
  };
}

export function roundVacationValue(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateVacationReceipt(data: VacationReceiptData): VacationCalculationResult {
  const baseRemuneration = roundVacationValue(data.salaryBase + data.avgVariables + data.otherPayItems);
  const vacationValue = roundVacationValue((baseRemuneration / 30) * data.vacationDays);
  const oneThirdValue = roundVacationValue(vacationValue / 3);
  const abonoValue = data.abonoEnabled ? roundVacationValue((baseRemuneration / 30) * data.abonoDays) : 0;
  const abonoOneThirdValue = data.abonoEnabled ? roundVacationValue(abonoValue / 3) : 0;
  const grossTotal = roundVacationValue(vacationValue + oneThirdValue + abonoValue + abonoOneThirdValue);
  const netTotal = roundVacationValue(grossTotal - data.discountsValue);
  return {
    baseRemuneration,
    vacationValue,
    oneThirdValue,
    abonoValue,
    abonoOneThirdValue,
    effectiveLeaveDays: Math.max(0, data.vacationDays - (data.abonoEnabled ? data.abonoDays : 0)),
    grossTotal,
    netTotal,
  };
}
