import { createContext, useContext, ReactNode } from 'react';
import type { PrizePolicy, PrizeCriterion, PrizeEmployee } from '@/hooks/usePrizePolicies';
import type { PrizeAssessment, AssessmentEmployee, CriterionResult } from '@/hooks/usePrizeAssessments';

export type PrizePublicApi = {
  policyId: string;
  // reads
  listCriteria: () => Promise<PrizeCriterion[]>;
  listEmployees: () => Promise<PrizeEmployee[]>;
  listAssessments: () => Promise<PrizeAssessment[]>;
  listAssessmentEmployees: (assessment_id: string) => Promise<(AssessmentEmployee & { employee: any })[]>;
  listCriterionResults: (ae_id: string) => Promise<CriterionResult[]>;
  // policy
  updatePolicy: (patch: Partial<PrizePolicy>) => Promise<void>;
  // criteria
  createCriterion: (payload: Partial<PrizeCriterion>) => Promise<void>;
  createCriteriaMany: (rows: Partial<PrizeCriterion>[]) => Promise<void>;
  updateCriterion: (id: string, patch: Partial<PrizeCriterion>) => Promise<void>;
  deleteCriterion: (id: string) => Promise<void>;
  // employees
  createEmployee: (payload: Partial<PrizeEmployee>) => Promise<void>;
  createEmployeesMany: (rows: Partial<PrizeEmployee>[]) => Promise<void>;
  updateEmployee: (id: string, patch: Partial<PrizeEmployee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  // assessments
  createAssessment: (competencia: string, observacao?: string | null) => Promise<PrizeAssessment>;
  updateAssessment: (id: string, patch: Partial<PrizeAssessment>) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;
  enrollAssessment: (assessment_id: string) => Promise<number>;
  updateAssessmentEmployee: (id: string, patch: Partial<AssessmentEmployee>) => Promise<void>;
  deleteAssessmentEmployee: (id: string) => Promise<void>;
  upsertCriterionResult: (ae_id: string, criterion_id: string, patch: Partial<CriterionResult>) => Promise<void>;
};

const Ctx = createContext<PrizePublicApi | null>(null);

export const PrizePublicApiProvider = ({ api, children }: { api: PrizePublicApi; children: ReactNode }) => (
  <Ctx.Provider value={api}>{children}</Ctx.Provider>
);

export const usePrizePublicApi = () => useContext(Ctx);