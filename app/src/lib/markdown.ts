import { format } from "date-fns";
import type { Invoice, Client, Project, Task } from "@/types";
import type { PRD } from "@/types/prd";

interface InvoiceExportContext {
  client?: Client;
  project?: Project;
}

interface TaskExportContext {
  project?: Project;
  client?: Client;
}

interface ProjectExportContext {
  client?: Client;
  tasks?: Task[];
}

interface PRDExportContext {
  project?: Project;
}

// ============================================
// Invoice Export
// ============================================

/**
 * Export an invoice to markdown format
 */
export function exportInvoiceToMarkdown(
  invoice: Invoice,
  context: InvoiceExportContext
): string {
  const { client, project } = context;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const issueDate = format(new Date(invoice.issueDate), "MMMM d, yyyy");
  const dueDate = format(new Date(invoice.dueDate), "MMMM d, yyyy");

  const lineItemsTable = invoice.lineItems
    .map(
      (item) =>
        `| ${item.description} | ${item.quantity} | ${formatCurrency(item.unitPrice)} | ${formatCurrency(item.amount)} |`
    )
    .join("\n");

  return `---
tags: [invoice, ${invoice.status}]
invoice_number: "${invoice.invoiceNumber}"
client: "${client?.name || "Unknown"}"
${project ? `project: "${project.name}"` : ""}
status: ${invoice.status}
amount: ${invoice.totalAmount}
currency: ${invoice.currency}
issue_date: ${invoice.issueDate}
due_date: ${invoice.dueDate}
${invoice.paidDate ? `paid_date: ${invoice.paidDate}` : ""}
---

# Invoice ${invoice.invoiceNumber}

## Details

| Field | Value |
|-------|-------|
| **Invoice Number** | ${invoice.invoiceNumber} |
| **Client** | ${client?.name || "Unknown"} |
| **Company** | ${client?.company || "-"} |
${project ? `| **Project** | ${project.name} |` : ""}
| **Issue Date** | ${issueDate} |
| **Due Date** | ${dueDate} |
| **Status** | ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)} |

## Line Items

| Description | Quantity | Unit Price | Total |
|-------------|----------|------------|-------|
${lineItemsTable}

## Summary

| | |
|---|---|
| **Subtotal** | ${formatCurrency(invoice.amount)} |
| **Tax (${invoice.taxRate}%)** | ${formatCurrency(invoice.taxAmount)} |
| **Total** | **${formatCurrency(invoice.totalAmount)}** |

${invoice.notes ? `## Notes\n\n${invoice.notes}` : ""}

---

## Payment Information

Please transfer the amount to:

- **Bank**: [Your Bank Name]
- **IBAN**: [Your IBAN]
- **BIC**: [Your BIC]
- **Reference**: ${invoice.invoiceNumber}

Payment is due by **${dueDate}**.

---

*Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}*
`;
}

// ============================================
// Task Export
// ============================================

const priorityLabels: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  queue: "Queue",
  in_progress: "In Progress",
  done: "Done",
};

/**
 * Export a task to markdown format
 */
export function exportTaskToMarkdown(
  task: Task,
  context: TaskExportContext = {}
): string {
  const { project, client } = context;

  const createdDate = format(new Date(task.createdAt), "MMMM d, yyyy");
  const dueDate = task.dueDate
    ? format(new Date(task.dueDate), "MMMM d, yyyy")
    : null;
  const completedDate = task.completedAt
    ? format(new Date(task.completedAt), "MMMM d, yyyy")
    : null;

  const tags = [
    "task",
    task.area,
    task.status,
    `priority-${priorityLabels[task.priority].toLowerCase()}`,
  ];

  return `---
tags: [${tags.join(", ")}]
status: ${task.status}
priority: ${task.priority}
area: ${task.area}
${project ? `project: "${project.name}"` : ""}
${client ? `client: "${client.name}"` : ""}
${task.dueDate ? `due_date: ${task.dueDate}` : ""}
${task.completedAt ? `completed_at: ${task.completedAt}` : ""}
created: ${task.createdAt}
---

# ${task.title}

## Details

| Field | Value |
|-------|-------|
| **Status** | ${statusLabels[task.status] || task.status} |
| **Priority** | ${priorityLabels[task.priority]} |
| **Area** | ${task.area.charAt(0).toUpperCase() + task.area.slice(1)} |
${project ? `| **Project** | ${project.name} |` : ""}
${client ? `| **Client** | ${client.name} |` : ""}
${dueDate ? `| **Due Date** | ${dueDate} |` : ""}
${completedDate ? `| **Completed** | ${completedDate} |` : ""}
| **Created** | ${createdDate} |

${task.description ? `## Description\n\n${task.description}` : ""}

${task.tags && task.tags.length > 0 ? `## Tags\n\n${task.tags.map((t) => `- ${t.name}`).join("\n")}` : ""}

---

*Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}*
`;
}

// ============================================
// Project Export
// ============================================

const projectStatusLabels: Record<string, string> = {
  pipeline: "Pipeline",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Export a project to markdown format
 */
export function exportProjectToMarkdown(
  project: Project,
  context: ProjectExportContext = {}
): string {
  const { client, tasks = [] } = context;

  const createdDate = format(new Date(project.createdAt), "MMMM d, yyyy");
  const startDate = project.startDate
    ? format(new Date(project.startDate), "MMMM d, yyyy")
    : null;
  const targetEndDate = project.targetEndDate
    ? format(new Date(project.targetEndDate), "MMMM d, yyyy")
    : null;

  const formatBudget = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: project.budgetCurrency,
    }).format(amount);
  };

  const tags = ["project", project.area, project.status];

  // Group tasks by status
  const tasksByStatus = tasks.reduce(
    (acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  const taskSection =
    tasks.length > 0
      ? `## Tasks

### In Progress (${tasksByStatus["in_progress"]?.length || 0})
${tasksByStatus["in_progress"]?.map((t) => `- [ ] ${t.title}`).join("\n") || "_No tasks in progress_"}

### Queue (${tasksByStatus["queue"]?.length || 0})
${tasksByStatus["queue"]?.map((t) => `- [ ] ${t.title}`).join("\n") || "_No tasks in queue_"}

### Backlog (${tasksByStatus["backlog"]?.length || 0})
${tasksByStatus["backlog"]?.map((t) => `- [ ] ${t.title}`).join("\n") || "_No tasks in backlog_"}

### Done (${tasksByStatus["done"]?.length || 0})
${tasksByStatus["done"]?.map((t) => `- [x] ${t.title}`).join("\n") || "_No completed tasks_"}
`
      : "";

  return `---
tags: [${tags.join(", ")}]
status: ${project.status}
area: ${project.area}
${client ? `client: "${client.name}"` : ""}
${project.budgetAmount ? `budget: ${project.budgetAmount}` : ""}
${project.budgetCurrency ? `currency: ${project.budgetCurrency}` : ""}
${project.startDate ? `start_date: ${project.startDate}` : ""}
${project.targetEndDate ? `target_end_date: ${project.targetEndDate}` : ""}
created: ${project.createdAt}
---

# ${project.name}

## Overview

| Field | Value |
|-------|-------|
| **Status** | ${projectStatusLabels[project.status] || project.status} |
| **Area** | ${project.area.charAt(0).toUpperCase() + project.area.slice(1)} |
${client ? `| **Client** | ${client.name} |` : ""}
${project.budgetAmount ? `| **Budget** | ${formatBudget(project.budgetAmount)} |` : ""}
${startDate ? `| **Start Date** | ${startDate} |` : ""}
${targetEndDate ? `| **Target End** | ${targetEndDate} |` : ""}
| **Created** | ${createdDate} |

${project.description ? `## Description\n\n${project.description}` : ""}

${taskSection}

---

*Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}*
`;
}

// ============================================
// PRD Export
// ============================================

const prdStatusLabels: Record<string, string> = {
  draft: "Draft",
  review: "In Review",
  approved: "Approved",
  in_progress: "In Progress",
  completed: "Completed",
};

const prdPriorityLabels: Record<string, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
};

/**
 * Export a PRD to markdown format
 */
export function exportPRDToMarkdown(
  prd: PRD,
  context: PRDExportContext = {}
): string {
  const { project } = context;

  const createdDate = format(new Date(prd.createdAt), "MMMM d, yyyy");
  const updatedDate = format(new Date(prd.updatedAt), "MMMM d, yyyy");

  const tags = ["prd", prd.area, prd.status];
  if (prd.assignee) tags.push(`assigned-${prd.assignee}`);

  // Build user stories section
  let userStoriesSection = "";
  if (prd.userStories && prd.userStories.length > 0) {
    const stories = prd.userStories.map((story, i) => {
      const criteria = story.acceptanceCriteria.map(c => `- [ ] ${c}`).join("\n");
      return `### Story ${i + 1}
**As a** ${story.persona}
**I want to** ${story.action}
**So that** ${story.benefit}

**Acceptance Criteria:**
${criteria}`;
    }).join("\n\n");
    
    userStoriesSection = `## User Stories

${stories}`;
  }

  // Build requirements section
  let requirementsSection = "";
  if (prd.requirements && prd.requirements.length > 0) {
    const functionalReqs = prd.requirements.filter(r => r.type === "functional");
    const nonFunctionalReqs = prd.requirements.filter(r => r.type === "non-functional");
    
    let frSection = "";
    if (functionalReqs.length > 0) {
      const frRows = functionalReqs.map((r, i) => 
        `| FR${i + 1} | ${r.description} | ${prdPriorityLabels[r.priority] || r.priority} |`
      ).join("\n");
      frSection = `### Functional Requirements

| # | Requirement | Priority |
|---|-------------|----------|
${frRows}`;
    }
    
    let nfrSection = "";
    if (nonFunctionalReqs.length > 0) {
      const nfrRows = nonFunctionalReqs.map((r, i) => 
        `| NFR${i + 1} | ${r.description} | ${prdPriorityLabels[r.priority] || r.priority} |`
      ).join("\n");
      nfrSection = `### Non-Functional Requirements

| # | Requirement | Priority |
|---|-------------|----------|
${nfrRows}`;
    }
    
    requirementsSection = `## Requirements

${frSection}

${nfrSection}`;
  }

  // Build technical section
  const technicalParts: string[] = [];
  
  if (prd.technicalApproach) {
    technicalParts.push(`### Technical Approach
${prd.technicalApproach}`);
  }
  
  if (prd.dependencies && prd.dependencies.length > 0) {
    technicalParts.push(`### Dependencies
${prd.dependencies.map(d => `- ${d}`).join("\n")}`);
  }
  
  if (prd.risks && prd.risks.length > 0) {
    technicalParts.push(`### Risks
${prd.risks.map(r => `- ⚠️ ${r}`).join("\n")}`);
  }
  
  if (prd.assumptions && prd.assumptions.length > 0) {
    technicalParts.push(`### Assumptions
${prd.assumptions.map(a => `- ${a}`).join("\n")}`);
  }
  
  if (prd.constraints && prd.constraints.length > 0) {
    technicalParts.push(`### Constraints
${prd.constraints.map(c => `- ${c}`).join("\n")}`);
  }
  
  const technicalSection = technicalParts.length > 0 
    ? `## Technical Considerations

${technicalParts.join("\n\n")}` 
    : "";

  // Build metrics section
  const metricsParts: string[] = [];
  
  if (prd.successMetrics && prd.successMetrics.length > 0) {
    metricsParts.push(`### Success Metrics
${prd.successMetrics.map(m => `- 📊 ${m}`).join("\n")}`);
  }
  
  if (prd.estimatedEffort) {
    metricsParts.push(`### Estimated Effort
${prd.estimatedEffort}`);
  }
  
  if (prd.milestones && prd.milestones.length > 0) {
    const milestoneRows = prd.milestones.map(m => {
      const targetDate = m.targetDate 
        ? format(new Date(m.targetDate), "MMM d, yyyy") 
        : "TBD";
      return `| ${m.title} | ${m.description || "-"} | ${targetDate} |`;
    }).join("\n");
    
    metricsParts.push(`### Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
${milestoneRows}`);
  }
  
  const metricsSection = metricsParts.length > 0 
    ? `## Success Metrics & Timeline

${metricsParts.join("\n\n")}` 
    : "";

  // Build non-goals section
  const nonGoalsSection = prd.nonGoals && prd.nonGoals.length > 0
    ? `### Non-Goals

${prd.nonGoals.map(ng => `- ${ng}`).join("\n")}`
    : "";

  // Build goals list
  const goalsList = prd.goals.map((g, i) => `${i + 1}. ${g}`).join("\n");

  // Build assignee info
  const assigneeInfo = prd.assignee 
    ? ` | **Assignee:** ${prd.assignee.charAt(0).toUpperCase() + prd.assignee.slice(1)}`
    : "";

  // Build overview table rows
  const overviewRows = [
    `| **Feature Name** | ${prd.featureName} |`,
    `| **Version** | ${prd.version} |`,
    `| **Area** | ${prd.area.charAt(0).toUpperCase() + prd.area.slice(1)} |`,
  ];
  
  if (project) {
    overviewRows.push(`| **Project** | ${project.name} |`);
  }
  
  overviewRows.push(`| **Status** | ${prdStatusLabels[prd.status] || prd.status} |`);
  overviewRows.push(`| **Author** | ${prd.author} |`);
  
  if (prd.assignee) {
    overviewRows.push(`| **Assignee** | ${prd.assignee.charAt(0).toUpperCase() + prd.assignee.slice(1)} |`);
  }
  
  overviewRows.push(`| **Created** | ${createdDate} |`);
  overviewRows.push(`| **Last Updated** | ${updatedDate} |`);

  return `---
tags: [${tags.join(", ")}]
feature_name: "${prd.featureName}"
version: "${prd.version}"
status: ${prd.status}
area: ${prd.area}
author: "${prd.author}"
${prd.assignee ? `assignee: "${prd.assignee}"` : ""}
${project ? `project: "${project.name}"` : ""}
created: ${prd.createdAt}
updated: ${prd.updatedAt}
---

# PRD: ${prd.featureName}

> **Version:** ${prd.version} | **Status:** ${prdStatusLabels[prd.status] || prd.status} | **Author:** ${prd.author}${assigneeInfo}

## Overview

| Field | Value |
|-------|-------|
${overviewRows.join("\n")}

## Problem Statement

${prd.problemStatement}

## Goals

${goalsList}

${nonGoalsSection}

## Target Users

${prd.targetUsers}

${userStoriesSection}

${requirementsSection}

${technicalSection}

${metricsSection}

---

*PRD generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}*
`;
}

// ============================================
// File Operations
// ============================================

/**
 * Download markdown content as a file
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy markdown content to clipboard
 */
export async function copyMarkdownToClipboard(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}

/**
 * Generate a safe filename from a title
 */
export function generateFilename(title: string, extension: string = "md"): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) + `.${extension}`
  );
}

/**
 * Get the suggested path for a task file
 */
export function getTaskPath(task: Task, workspacePath: string): string {
  const statusFolder =
    task.status === "done"
      ? "Done"
      : task.status === "in_progress"
        ? "InProgress"
        : task.status === "queue"
          ? "Queue"
          : "Backlog";
  const filename = generateFilename(task.title);
  return `${workspacePath}/Tasks/${statusFolder}/${filename}`;
}

/**
 * Get the suggested path for a project file
 */
export function getProjectPath(project: Project, workspacePath: string): string {
  const areaFolder =
    project.area === "wellfy"
      ? "Wellfy"
      : project.area === "freelance"
        ? "Freelance"
        : "Personal";
  const filename = generateFilename(project.name);
  return `${workspacePath}/Areas/${areaFolder}/Projects/${filename}`;
}

/**
 * Get the suggested path for an invoice file
 */
export function getInvoicePath(invoice: Invoice, workspacePath: string): string {
  const filename = `${invoice.invoiceNumber}.md`;
  return `${workspacePath}/Areas/Finances/Invoices/${filename}`;
}

/**
 * Get the suggested path for a PRD file
 */
export function getPRDPath(prd: PRD, workspacePath: string): string {
  const areaFolder =
    prd.area === "wellfy"
      ? "Wellfy"
      : prd.area === "freelance"
        ? "Freelance"
        : "Personal";
  const filename = `PRD-${generateFilename(prd.featureName)}`;
  return `${workspacePath}/Areas/${areaFolder}/PRDs/${filename}`;
}
