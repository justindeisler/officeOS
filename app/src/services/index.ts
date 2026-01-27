// Service layer - all database operations
export { clientService } from "./clientService";
export { projectService } from "./projectService";
export { taskService } from "./taskService";
export { tagService } from "./tagService";
export { timeEntryService } from "./timeEntryService";
export { invoiceService } from "./invoiceService";
export { captureService } from "./captureService";
export { settingsService } from "./settingsService";
// Note: backupService and attachmentService are NOT exported here to avoid
// static Tauri imports blocking React mount.
// Import directly: @/services/backupService or @/services/attachmentService
// blocking React mount. Import directly from @/services/attachmentService instead.

// Base utilities
export { toDbFormat, fromDbFormat } from "./base";
