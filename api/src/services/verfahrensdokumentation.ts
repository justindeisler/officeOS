/**
 * Verfahrensdokumentation Generator
 * 
 * GoBD requires documentation of how the accounting system works,
 * including data flow, controls, user responsibilities, and archiving.
 * 
 * This generates a dynamic Verfahrensdokumentation based on the current
 * system configuration.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';

const log = createLogger('verfahrensdoku');

export interface VerfahrensdokuSection {
  title: string;
  content: string;
  subsections?: VerfahrensdokuSection[];
}

export interface Verfahrensdokumentation {
  title: string;
  version: string;
  generatedAt: string;
  companyName: string;
  sections: VerfahrensdokuSection[];
}

/**
 * Generate the Verfahrensdokumentation based on current system state.
 */
export function generateVerfahrensdokumentation(
  db: Database.Database
): Verfahrensdokumentation {
  // Get company info from settings
  const getSetting = (key: string): string | null => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  };

  const companyName = getSetting('company_name') || '[Firmenname eintragen]';
  const taxNumber = getSetting('tax_number') || '[Steuernummer eintragen]';
  const vatId = getSetting('vat_id') || '[USt-IdNr. eintragen]';

  // Count records for statistics
  const incomeCount = (db.prepare('SELECT COUNT(*) as n FROM income WHERE is_deleted IS NULL OR is_deleted = 0').get() as { n: number }).n;
  const expenseCount = (db.prepare('SELECT COUNT(*) as n FROM expenses WHERE is_deleted IS NULL OR is_deleted = 0').get() as { n: number }).n;
  const invoiceCount = (db.prepare('SELECT COUNT(*) as n FROM invoices').get() as { n: number }).n;
  const assetCount = (db.prepare('SELECT COUNT(*) as n FROM assets').get() as { n: number }).n;
  const auditCount = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n;
  const lockCount = (db.prepare('SELECT COUNT(*) as n FROM period_locks').get() as { n: number }).n;

  return {
    title: 'Verfahrensdokumentation gemäß GoBD',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    companyName,
    sections: [
      {
        title: '1. Allgemeine Beschreibung',
        content: `
Diese Verfahrensdokumentation beschreibt das eingesetzte Buchführungssystem 
"officeOS" für die Einnahmenüberschussrechnung (EÜR) gemäß § 4 Abs. 3 EStG 
des Unternehmens ${companyName}.

**Steuernummer:** ${taxNumber}
**USt-IdNr.:** ${vatId}

Das System wird für folgende Zwecke eingesetzt:
- Erfassung und Verwaltung von Einnahmen und Ausgaben
- Erstellung von Rechnungen
- Verwaltung von Anlagegütern und Abschreibungen
- Erstellung der Umsatzsteuer-Voranmeldung
- Erstellung der Einnahmenüberschussrechnung (Anlage EÜR)
- DATEV-Export für den Steuerberater

**Aktuelle Datenbasis:**
- ${incomeCount} Einnahmenbelege
- ${expenseCount} Ausgabenbelege
- ${invoiceCount} Rechnungen
- ${assetCount} Anlagegüter
- ${auditCount} Änderungsprotokolleinträge
- ${lockCount} gesperrte Zeiträume
        `.trim(),
      },
      {
        title: '2. Systemarchitektur',
        content: `
**Software:** officeOS (Eigenentwicklung)
**Datenbank:** SQLite mit WAL-Modus (Write-Ahead Logging)
**Server:** Node.js REST API mit Express.js
**Frontend:** React Web Application (Progressive Web App)
**Hosting:** Selbstgehostet auf eigenem Server

**Datenspeicherung:**
- Alle Geschäftsdaten werden in einer SQLite-Datenbank gespeichert
- Belege und Anhänge werden im Dateisystem gespeichert
- Tägliche automatische Backups mit Rotation (30 Tage)
- WAL-Modus gewährleistet Datenkonsistenz bei gleichzeitigen Zugriffen
        `.trim(),
      },
      {
        title: '3. Datenfluss und Belegerfassung',
        content: `
**3.1 Einnahmen (Zufluss-Prinzip)**
1. Rechnung wird erstellt (Entwurf → Versand)
2. Bei Zahlungseingang wird Rechnung als "bezahlt" markiert
3. Automatische Erstellung eines Einnahmeneintrags mit:
   - Zuordnung zur Rechnung
   - Berechnung der Umsatzsteuer
   - Zuordnung zur EÜR-Zeile (Standard: Zeile 14)
   - Vergabe einer fortlaufenden Belegnummer (EI-JJJJ-NNN)

**3.2 Ausgaben (Abfluss-Prinzip)**
1. Ausgabe wird erfasst mit Datum, Betrag, Kategorie
2. Automatische Berechnung der Vorsteuer
3. Kategoriebasierte Zuordnung zur EÜR-Zeile
4. Vergabe einer fortlaufenden Belegnummer (EA-JJJJ-NNN)
5. Optional: Belegbild per OCR-Erkennung

**3.3 Anlagegüter**
1. Anlage wird mit Kaufdatum, Preis, Nutzungsdauer erfasst
2. Automatische Erstellung des AfA-Plans (linear/degressiv)
3. Pro-rata-Berechnung im Anschaffungsjahr
4. GWG-Automatik: Sofortabschreibung bis €800 netto
        `.trim(),
      },
      {
        title: '4. Ordnungsmäßigkeit (GoBD-Konformität)',
        content: `
Das System implementiert die sechs Grundsätze der GoBD:

**4.1 Nachvollziehbarkeit und Nachprüfbarkeit**
- Jede Buchung enthält Belegnummer, Datum, Betrag und Buchungstext
- Änderungshistorie (Audit Trail) protokolliert alle Änderungen
- Verknüpfung zwischen Rechnung → Einnahme → USt-VA

**4.2 Vollständigkeit**
- Fortlaufende, lückenlose Belegnummerierung
- Soft-Delete statt physischem Löschen
- Alle Geschäftsvorfälle werden erfasst

**4.3 Richtigkeit**
- Automatische Berechnung von USt und Vorsteuer
- Validierung bei der Dateneingabe (Pflichtfelder, Formate)
- Abgleich zwischen Rechnung und Einnahme

**4.4 Zeitgerechte Buchung**
- Sofortige Erfassung bei Zahlungsein-/-ausgang
- Periodenzuordnung nach Zahlungsdatum (EÜR-Prinzip)

**4.5 Ordnung**
- Systematische Kategorisierung nach EÜR-Zeilen
- Standardisierte Kontenrahmen (SKR03/SKR04) für DATEV-Export
- Strukturierte Ablage von Belegen

**4.6 Unveränderbarkeit**
- Änderungsprotokoll (audit_log) ist durch SQLite-Trigger vor 
  Löschung und Änderung geschützt
- Festschreibung (Periodensperren) verhindert nachträgliche 
  Änderungen in abgeschlossenen Zeiträumen
- Soft-Delete statt physischem Löschen
        `.trim(),
      },
      {
        title: '5. Änderungsprotokoll (Audit Trail)',
        content: `
Jede Änderung an finanziellen Datensätzen wird protokolliert:

**Protokollierte Informationen:**
- Entitätstyp (Einnahme, Ausgabe, Rechnung, Anlage)
- Entitäts-ID
- Aktion (Erstellen, Ändern, Löschen, Sperren)
- Geänderte Felder mit altem und neuem Wert
- Benutzer-ID
- IP-Adresse und User-Agent
- Zeitstempel (sekundengenau)
- Session-ID (für zusammengehörige Änderungen)

**Schutz der Protokolldaten:**
- SQLite-Trigger verhindern DELETE auf audit_log
- SQLite-Trigger verhindern UPDATE auf audit_log
- Einträge können nur über INSERT hinzugefügt werden
- Das Protokoll ist damit manipulationssicher

**Aktueller Stand:** ${auditCount} Protokolleinträge
        `.trim(),
      },
      {
        title: '6. Festschreibung (Periodensperren)',
        content: `
Nach Abgabe der Umsatzsteuer-Voranmeldung oder dem Jahresabschluss 
werden die betroffenen Zeiträume gesperrt:

**Sperrtypen:**
- Monats-Sperre (z.B. 2025-01)
- Quartals-Sperre (z.B. 2025-Q1) 
- Jahres-Sperre (z.B. 2025)

**Auswirkungen einer Sperre:**
- Keine Erstellung neuer Buchungen im gesperrten Zeitraum
- Keine Änderung bestehender Buchungen
- Keine Löschung von Buchungen
- Sperre kann nur mit dokumentiertem Grund aufgehoben werden

**Aktueller Stand:** ${lockCount} gesperrte Zeiträume
        `.trim(),
      },
      {
        title: '7. Aufbewahrungsfristen',
        content: `
Gemäß § 147 AO gelten folgende Aufbewahrungsfristen:

| Dokumenttyp | Frist | Implementierung |
|------------|-------|-----------------|
| Bücher und Aufzeichnungen | 10 Jahre | Datenbank-Retention |
| Buchungsbelege (Rechnungen) | 10 Jahre | retention_type = 'accounting' |
| Empfangene Geschäftsbriefe | 6 Jahre | retention_type = 'correspondence' |
| Kassenbelege/Quittungen | 10 Jahre | retention_type = 'receipt' |

**Technische Umsetzung:**
- Jeder Anhang erhält ein retention_until Datum
- Löschung vor Ablauf der Frist wird durch deletion_blocked verhindert
- Automatische Berechnung der Aufbewahrungsfrist bei Upload
        `.trim(),
      },
      {
        title: '8. Datensicherung',
        content: `
**Backup-Verfahren:**
- Tägliche automatische Sicherung der SQLite-Datenbank
- Rotation: 30 Tage aufbewahrt
- Backup-Pfad: Serverseitiges Dateisystem
- Integritätsprüfung bei der Sicherung

**Wiederherstellung:**
- Restore aus beliebigem täglichen Backup möglich
- Konsistente Snapshots durch SQLite WAL-Modus
        `.trim(),
      },
      {
        title: '9. Zugriffsschutz',
        content: `
**Authentifizierung:**
- Passwortgeschützter Zugang (JWT-basiert)
- Rate-Limiting (300 Anfragen/15 Min, 20 Login-Versuche/15 Min)
- HTTPS-Verschlüsselung (TLS)

**Autorisierung:**
- Einzelbenutzer-System (Inhaber = Administrator)
- Alle API-Endpunkte durch Authentifizierung geschützt
- CORS-Beschränkung auf bekannte Origins

**Datenschutz:**
- Daten auf eigenem Server gespeichert (kein Cloud-Anbieter)
- Verschlüsselte Kommunikation (HTTPS)
- Keine Weitergabe an Dritte (außer Steuerberater via DATEV-Export)
        `.trim(),
      },
      {
        title: '10. Kontaktinformationen',
        content: `
**Verantwortlich für die Buchführung:**
${companyName}
Steuernummer: ${taxNumber}
USt-IdNr.: ${vatId}

**Software-Verantwortlicher:**
${companyName}

**Steuerberater:**
[Name und Anschrift des Steuerberaters eintragen]

Diese Verfahrensdokumentation wird bei wesentlichen Änderungen am 
Buchführungssystem aktualisiert.
        `.trim(),
      },
    ],
  };
}

/**
 * Render the Verfahrensdokumentation as Markdown.
 */
export function renderVerfahrensdokuAsMarkdown(doc: Verfahrensdokumentation): string {
  let md = `# ${doc.title}\n\n`;
  md += `**Unternehmen:** ${doc.companyName}\n`;
  md += `**Version:** ${doc.version}\n`;
  md += `**Erstellt am:** ${new Date(doc.generatedAt).toLocaleDateString('de-DE')}\n\n`;
  md += `---\n\n`;

  for (const section of doc.sections) {
    md += `## ${section.title}\n\n`;
    md += `${section.content}\n\n`;

    if (section.subsections) {
      for (const sub of section.subsections) {
        md += `### ${sub.title}\n\n`;
        md += `${sub.content}\n\n`;
      }
    }
  }

  md += `---\n\n`;
  md += `*Dieses Dokument wurde automatisch generiert am ${new Date(doc.generatedAt).toLocaleString('de-DE')}.*\n`;

  return md;
}
