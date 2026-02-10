const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-DKLwIOGN.js","assets/core-BDPGcIsz.js"])))=>i.map(i=>d[i]);
import{_ as L}from"./index-CDa-V2nq.js";let i=null,a=null;function N(){return typeof window<"u"&&"__TAURI__"in window&&!!window.__TAURI__}async function r(){return i||a||(a=(async()=>{if(!N())return console.log("[Accounting DB] Web mode detected - using REST API for data"),{select:async()=>[],execute:async()=>({rowsAffected:0}),close:async()=>{}};const{default:e}=await L(async()=>{const{default:T}=await import("./index-DKLwIOGN.js");return{default:T}},__vite__mapDeps([0,1]));return i=await e.load("sqlite:personal-assistant.db"),await _(i),i})(),a)}async function _(e){await e.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      vat_id TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      client_id TEXT REFERENCES clients(id),
      invoice_id TEXT REFERENCES invoices(id),
      description TEXT NOT NULL,
      net_amount DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      gross_amount DECIMAL(10,2) NOT NULL,
      euer_line INTEGER DEFAULT 14,
      euer_category TEXT DEFAULT 'services',
      payment_method TEXT,
      bank_reference TEXT,
      ust_period TEXT,
      ust_reported BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      vendor TEXT NOT NULL,
      description TEXT NOT NULL,
      net_amount DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      gross_amount DECIMAL(10,2) NOT NULL,
      euer_line INTEGER NOT NULL,
      euer_category TEXT NOT NULL,
      deductible_percent INTEGER DEFAULT 100,
      payment_method TEXT,
      receipt_path TEXT,
      is_recurring BOOLEAN DEFAULT FALSE,
      recurring_frequency TEXT,
      ust_period TEXT,
      vorsteuer_claimed BOOLEAN DEFAULT FALSE,
      is_gwg BOOLEAN DEFAULT FALSE,
      asset_id TEXT REFERENCES assets(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'draft',
      client_id TEXT REFERENCES clients(id),
      project_id TEXT REFERENCES projects(id),
      subtotal DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      payment_date DATE,
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit TEXT DEFAULT 'hours',
      unit_price DECIMAL(10,2) NOT NULL,
      amount DECIMAL(10,2) NOT NULL
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      purchase_date DATE NOT NULL,
      vendor TEXT,
      purchase_price DECIMAL(10,2) NOT NULL,
      vat_paid DECIMAL(10,2) NOT NULL,
      gross_price DECIMAL(10,2) NOT NULL,
      afa_method TEXT DEFAULT 'linear',
      afa_years INTEGER NOT NULL,
      afa_start_date DATE NOT NULL,
      afa_annual_amount DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'active',
      disposal_date DATE,
      disposal_price DECIMAL(10,2),
      euer_line INTEGER DEFAULT 30,
      euer_category TEXT DEFAULT 'afa_beweglich',
      category TEXT,
      inventory_number TEXT,
      location TEXT DEFAULT 'Home Office',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS depreciation_schedule (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      months INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      cumulative DECIMAL(10,2) NOT NULL,
      book_value DECIMAL(10,2) NOT NULL
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS euer_categories (
      id TEXT PRIMARY KEY,
      line_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      vorsteuer_eligible BOOLEAN DEFAULT TRUE
    )
  `),await e.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `),await e.execute("CREATE INDEX IF NOT EXISTS idx_income_date ON income(date)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_income_client_id ON income(client_id)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_income_ust_period ON income(ust_period)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_expenses_euer_category ON expenses(euer_category)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_expenses_ust_period ON expenses(ust_period)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_depreciation_asset_id ON depreciation_schedule(asset_id)"),await s(e)}async function s(e){await E(e,"assets","bill_path","TEXT");const t=(await e.select("PRAGMA table_info(invoices)")).map(n=>n.name);(t.includes("amount")||t.includes("total_amount"))&&(console.log("Migrating invoices table from old schema to new accounting schema..."),await e.execute(`
      CREATE TABLE invoices_new (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'draft',
        client_id TEXT REFERENCES clients(id),
        project_id TEXT REFERENCES projects(id),
        subtotal DECIMAL(10,2) NOT NULL,
        vat_rate INTEGER DEFAULT 19,
        vat_amount DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        payment_date DATE,
        payment_method TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),await e.execute(`
      INSERT INTO invoices_new (
        id, invoice_number, invoice_date, due_date, status, client_id, project_id,
        subtotal, vat_rate, vat_amount, total, payment_date, notes, created_at
      )
      SELECT
        id,
        invoice_number,
        COALESCE(invoice_date, issue_date),
        due_date,
        status,
        client_id,
        project_id,
        COALESCE(subtotal, amount, 0),
        COALESCE(vat_rate, tax_rate, 19),
        COALESCE(vat_amount, tax_amount, 0),
        COALESCE(total, total_amount, 0),
        COALESCE(payment_date, paid_date),
        notes,
        created_at
      FROM invoices
    `),await e.execute("DROP TABLE invoices"),await e.execute("ALTER TABLE invoices_new RENAME TO invoices"),await e.execute("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)"),await e.execute("CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)"),console.log("Invoices table migration completed")),await E(e,"invoices","invoice_date","DATE"),await E(e,"invoices","due_date","DATE"),await E(e,"invoices","status","TEXT DEFAULT 'draft'"),await E(e,"invoices","client_id","TEXT"),await E(e,"invoices","subtotal","DECIMAL(10,2)"),await E(e,"invoices","vat_rate","INTEGER DEFAULT 19"),await E(e,"invoices","vat_amount","DECIMAL(10,2)"),await E(e,"invoices","total","DECIMAL(10,2)"),await E(e,"invoices","payment_date","DATE"),await E(e,"invoices","payment_method","TEXT"),await E(e,"invoices","notes","TEXT"),await E(e,"invoices","project_id","TEXT")}async function E(e,T,t,o){try{(await e.select(`PRAGMA table_info(${T})`)).some(c=>c.name===t)||(await e.execute(`ALTER TABLE ${T} ADD COLUMN ${t} ${o}`),console.log(`Migration: Added ${t} column to ${T} table`))}catch(n){console.error(`Migration failed for ${T}.${t}:`,n)}}export{r as g};
