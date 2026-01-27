import { format } from "date-fns";
import type { Invoice, Client, Project, Task } from "@/types";

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
        `| ${item.description} | ${item.quantity} | ${formatCurrency(item.unitPrice)} | ${formatCurrency(item.total)} |`
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
