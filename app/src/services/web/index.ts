/**
 * Web services index - exports API-based service implementations
 */

export { taskService } from "./taskService";
export { projectService } from "./projectService";
export { clientService } from "./clientService";
export { timeEntryService } from "./timeEntryService";
export { captureService } from "./captureService";
export { settingsService } from "./settingsService";
export { tagService } from "./tagService";
export { invoiceService } from "./invoiceService";

// Base utilities
export { toDbFormat, fromDbFormat } from "./base";
