# BatchLedger

BatchLedger is a local-first ERP for small food manufacturers. It connects multi-producer customer orders with purchasing, seller-owned inventory, production, GST invoicing, payments, dispatch, notifications, and audit history.

## Features

- Customer, supplier, product, and material records
- Bills of materials, purchase tracking, and stock ledger
- Production runs, costing, and variance alerts
- Customer signup and a multi-producer marketplace with search and category/producer filters
- Admin-managed seller accounts with exclusive product and raw-material assignments
- One customer checkout split into seller-specific ERP orders under a shared order reference
- Seller workspaces for product management, BOM versioning, seller-owned stock receipts, production costing, invoices, and financial summaries
- Producer business-state registration and state-based CGST/SGST or IGST invoicing
- Persistent seller/customer notifications, production timelines, parcel tracking, and invoice downloads
- Sales orders, dispatches, GST invoices, and payment tracking
- Reports and audit history
- Role-based sign-in with Admin, Seller, Customer, Salesman, Production Supervisor, and Auditor permissions
- Admin-managed staff accounts with bcrypt password hashes and revocable, HttpOnly sessions
- SQLite database for local development

## Project layout

```text
NIT/batchledger/
  client/   React, Vite, Tailwind CSS
  server/   Express API, Prisma, SQLite
```

## Requirements

- Node.js 18.18 or newer
- npm

## Run locally (Windows PowerShell)

Open two PowerShell terminals from the repository root.

### 1. Set up and start the API

```powershell
Set-Location .\NIT\batchledger\server
npm ci
npm run db:generate
npm run db:push
$env:INITIAL_ADMIN_NAME = "Your Name"
$env:INITIAL_ADMIN_EMAIL = "you@example.com"
$env:INITIAL_ADMIN_PASSWORD = "Choose-a-unique-password-12-chars-or-longer"
npm run db:seed
$env:PORT = "5001"
$secret = [Environment]::GetEnvironmentVariable("JWT_SECRET", "User")
if (-not $secret) {
  $secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  [Environment]::SetEnvironmentVariable("JWT_SECRET", $secret, "User")
}
$env:JWT_SECRET = $secret
npm run dev
```

On a new database, the seed command creates the initial administrator from the three `INITIAL_ADMIN_*` values and loads sample business data. It does not create fixed demo staff accounts or print passwords. After signing in, use **User Management** to create seller accounts, assign products, and set each producer's business state for GST. Producers who self-register select their business state during signup. Older seller accounts without a saved state use the configured `BUSINESS_STATE` default until an administrator sets their state. In each seller workspace, create seller-owned raw materials and record receipts with quantities and costs. Create or version a BOM for each product using only that seller's materials before production can start. Existing active administrators are retained when reseeding; legacy demo accounts from older database seeds are deactivated.

`JWT_SECRET` must be a random value of at least 32 bytes and remain the same across API restarts so existing sessions can be verified. The PowerShell commands above generate it once and store it in the current Windows user's environment. The SQLite database is created under `server/prisma/`.

### 2. Set up and start the web client

```powershell
Set-Location .\NIT\batchledger\client
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173). The client proxies `/api` requests to the API on port 5000.

## Customer ordering

Choose **Customer Portal** on the landing page and create a customer account. Customers can browse all active sellers, filter/search products, combine products from different sellers, and track the combined order reference. The API creates an ERP order for each seller and notifies each seller independently. Sellers sign in through the regular login form and are directed to their isolated seller workspace.

Seller orders follow the status timeline from receipt through delivery. Starting production creates a linked ERP production run using the active BOM. The seller completes it in the Production tab by recording actual output, assigned-material usage, and multiple expense types; material usage is compared with the BOM scaled to the planned batch size. The workspace shows the estimated BOM material cost and actual production cost per good unit. Marking production complete posts the seller's GST invoice, using the producer's business state to split CGST/SGST or IGST. Dispatch creates the ERP dispatch and stock movement, and records the tracking reference for the customer. Customers can download each seller invoice as a PDF.

Delivery charges are read from the `marketplace_delivery_charge` system configuration key, or the `MARKETPLACE_DELIVERY_CHARGE` environment variable when no key is set. The default is zero.

## Build and focused API tests

Build the client:

```powershell
Set-Location .\NIT\batchledger\client
npm run build
```

Run the customer portal API tests:

```powershell
Set-Location .\NIT\batchledger\server
$env:PORT = "5010"
$env:JWT_SECRET = (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
node --experimental-vm-modules .\node_modules\jest\bin\jest.js --runInBand --forceExit --testNamePattern="Customer portal"
```
