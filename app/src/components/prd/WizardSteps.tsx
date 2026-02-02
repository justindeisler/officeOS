import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRD_WIZARD_STEPS } from "@/types/prd";
import type { PRDFormData } from "@/types/prd";

interface WizardStepsProps {
  currentStep: number;
  formData: PRDFormData;
  onStepClick?: (step: number) => void;
}

export function WizardSteps({ currentStep, formData, onStepClick }: WizardStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between w-full">
        {PRD_WIZARD_STEPS.map((step, index) => {
          const isComplete = step.isComplete(formData) && step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isPast = step.id < currentStep;

          return (
            <li key={step.id} className="flex-1 flex items-center">
              {/* Connector line (before) */}
              {index > 0 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    isPast || isCurrent ? "bg-primary" : "bg-muted"
                  )}
                />
              )}

              {/* Step circle + label container */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  disabled={!onStepClick}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    !isCurrent && !isComplete && "border-muted bg-background text-muted-foreground",
                    onStepClick && "cursor-pointer hover:border-primary/80"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </button>

                {/* Step label (below circle) */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium whitespace-nowrap",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line (after) */}
              {index < PRD_WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    isPast ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
