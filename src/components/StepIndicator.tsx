import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

const StepIndicator = ({ currentStep, totalSteps, labels }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        const isPending = step > currentStep;

        return (
          <div key={step} className="flex items-center gap-2 md:gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`step-badge ${
                  isActive ? 'step-badge-active' : isCompleted ? 'step-badge-completed' : 'step-badge-pending'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : step}
              </div>
              <span
                className={`text-xs md:text-sm font-medium text-center max-w-[80px] md:max-w-none ${
                  isActive ? 'text-foreground' : isPending ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`hidden md:block w-16 h-0.5 mb-5 ${
                  step < currentStep ? 'bg-success' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
