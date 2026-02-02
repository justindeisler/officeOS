/**
 * PRD (Product Requirements Document) types
 */

import type { Assignee, Area } from "./index";

export type PRDStatus = "draft" | "review" | "approved" | "in_progress" | "completed" | "implemented";
export type PRDPriority = "critical" | "high" | "medium" | "low";

export interface UserStory {
  id: string;
  persona: string;
  action: string;
  benefit: string;
  acceptanceCriteria: string[];
}

export interface Requirement {
  id: string;
  type: "functional" | "non-functional";
  description: string;
  priority: PRDPriority;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
}

export interface PRD {
  id: string;
  projectId?: string;
  
  // Step 1: Basic Info
  featureName: string;
  version: string;
  author: string;
  assignee?: Assignee;
  area: Area;
  status: PRDStatus;
  
  // Step 2: Problem & Goals
  problemStatement: string;
  goals: string[];
  nonGoals?: string[];
  
  // Step 3: User Stories & Requirements
  targetUsers: string;
  userStories: UserStory[];
  requirements: Requirement[];
  
  // Step 4: Technical Considerations
  technicalApproach?: string;
  dependencies?: string[];
  risks?: string[];
  assumptions?: string[];
  constraints?: string[];
  
  // Step 5: Success Metrics & Timeline
  successMetrics?: string[];
  milestones?: Milestone[];
  estimatedEffort?: string;
  
  // Metadata
  markdownPath?: string;
  createdAt: string;
  updatedAt: string;
}

// Form data for the wizard (all optional until final submission)
export interface PRDFormData {
  // Step 1
  projectId?: string;
  featureName?: string;
  version?: string;
  author?: string;
  assignee?: Assignee;
  area?: Area;
  
  // Step 2
  problemStatement?: string;
  goals?: string[];
  nonGoals?: string[];
  
  // Step 3
  targetUsers?: string;
  userStories?: UserStory[];
  requirements?: Requirement[];
  
  // Step 4
  technicalApproach?: string;
  dependencies?: string[];
  risks?: string[];
  assumptions?: string[];
  constraints?: string[];
  
  // Step 5
  successMetrics?: string[];
  milestones?: Milestone[];
  estimatedEffort?: string;
}

// Wizard step configuration
export interface WizardStep {
  id: number;
  title: string;
  description: string;
  isComplete: (data: PRDFormData) => boolean;
}

export const PRD_WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: "Project & Feature",
    description: "Select project and name your feature",
    isComplete: (data) => !!(data.featureName && data.area),
  },
  {
    id: 2,
    title: "Problem & Goals",
    description: "Define the problem and objectives",
    isComplete: (data) => !!(data.problemStatement && data.goals && data.goals.length > 0),
  },
  {
    id: 3,
    title: "Users & Requirements",
    description: "Document user stories and requirements",
    isComplete: (data) => !!(
      data.targetUsers && 
      data.userStories && 
      data.userStories.length > 0 && 
      data.requirements && 
      data.requirements.length > 0
    ),
  },
  {
    id: 4,
    title: "Technical Details",
    description: "Technical approach and considerations",
    isComplete: () => true, // Optional step
  },
  {
    id: 5,
    title: "Review & Generate",
    description: "Review and create your PRD",
    isComplete: () => true,
  },
];
