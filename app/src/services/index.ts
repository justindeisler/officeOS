// Service layer - all database operations
// Uses REST API in web mode, SQLite in Tauri mode

import { isWebBuild } from "@/lib/api";

// Import both implementations
import * as tauriServices from "./tauri";
import * as webServices from "./web";

// Choose implementation based on environment
const services = isWebBuild() ? webServices : tauriServices;

export const clientService = services.clientService;
export const projectService = services.projectService;
export const taskService = services.taskService;
export const tagService = services.tagService;
export const timeEntryService = services.timeEntryService;
export const invoiceService = services.invoiceService;
export const captureService = services.captureService;
export const settingsService = services.settingsService;

// Note: backupService and attachmentService are NOT exported here to avoid
// static Tauri imports blocking React mount.
// Import directly: @/services/backupService or @/services/attachmentService

// Base utilities
export { toDbFormat, fromDbFormat } from "./base";
