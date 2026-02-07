#!/usr/bin/env tsx
/**
 * Daily Backup Script
 *
 * Run manually: cd api && npx tsx src/scripts/daily-backup.ts
 * Or via systemd timer (see pa-backup.service / pa-backup.timer)
 *
 * Creates an encrypted backup of the PA database and rotates old backups.
 */

import "dotenv/config";
import { runDailyBackup } from "../services/backup.js";

function main() {
  console.log(`[${new Date().toISOString()}] Starting daily PA backup...`);

  try {
    const result = runDailyBackup();

    console.log(`✅ Backup created: ${result.backup.filename}`);
    console.log(`   Size: ${(result.backup.sizeBytes / 1024).toFixed(1)} KB`);
    console.log(`   Encrypted: ${result.backup.encrypted}`);

    if (result.rotation.deleted.length > 0) {
      console.log(`🗑️  Rotated ${result.rotation.deleted.length} old backup(s)`);
    }
    console.log(`📦 Total backups kept: ${result.rotation.kept}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Backup failed:", err);
    process.exit(1);
  }
}

main();
