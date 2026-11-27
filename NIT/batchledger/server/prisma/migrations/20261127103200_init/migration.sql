-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "businessState" TEXT,
    "businessStateCode" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "customerId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "state" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "gstRate" REAL NOT NULL DEFAULT 5,
    "hsnCode" TEXT,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "sellerId" INTEGER,
    "category" TEXT,
    "imageUrl" TEXT,
    "preparationMinutes" INTEGER NOT NULL DEFAULT 60,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "materials" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "reorderLevel" REAL NOT NULL DEFAULT 0,
    "sellerId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "materials_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "boms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "batchSize" REAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "boms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bomId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "bom_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bom_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materialId" INTEGER,
    "productId" INTEGER,
    "currentQty" REAL NOT NULL DEFAULT 0,
    "avgCost" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "stock_ledger_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_ledger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movementType" TEXT NOT NULL,
    "referenceId" INTEGER,
    "referenceType" TEXT,
    "materialId" INTEGER,
    "productId" INTEGER,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "balanceQty" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchNo" TEXT NOT NULL,
    "bomId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "plannedOutput" REAL NOT NULL,
    "actualOutput" REAL NOT NULL DEFAULT 0,
    "damagedQty" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "productionDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "notes" TEXT,
    "supervisorId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "production_runs_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_runs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_runs_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_runs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_issues" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionRunId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "standardQty" REAL NOT NULL,
    "actualQty" REAL NOT NULL,
    "returnedQty" REAL NOT NULL DEFAULT 0,
    "netQty" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    CONSTRAINT "production_issues_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_issues_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_expenses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionRunId" INTEGER NOT NULL,
    "expenseType" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_expenses_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "production_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_variances" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productionRunId" INTEGER NOT NULL,
    "varianceType" TEXT NOT NULL,
    "materialId" INTEGER,
    "standardQty" REAL NOT NULL,
    "actualQty" REAL NOT NULL,
    "variancePct" REAL NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "production_variances_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_runs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderDate" DATETIME NOT NULL,
    "requiredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sellerId" INTEGER,
    "marketplaceOrderId" TEXT,
    "deliveryCharge" REAL NOT NULL DEFAULT 0,
    "deliveryAddress" TEXT,
    "deliveryMethod" TEXT,
    "trackingReference" TEXT,
    "specialInstructions" TEXT,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "marketplace_orders" ("reference") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "reference" TEXT NOT NULL PRIMARY KEY,
    "customerId" INTEGER NOT NULL,
    "subtotal" REAL NOT NULL,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "deliveryCharge" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "marketplace_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "orderedQty" REAL NOT NULL,
    "displayQty" REAL,
    "availableQty" REAL NOT NULL DEFAULT 0,
    "shortageQty" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "unit" TEXT,
    CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "marketplaceOrderReference" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_marketplaceOrderReference_fkey" FOREIGN KEY ("marketplaceOrderReference") REFERENCES "marketplace_orders" ("reference") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "productId" INTEGER,
    "body" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceNo" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "cgst" REAL NOT NULL DEFAULT 0,
    "sgst" REAL NOT NULL DEFAULT 0,
    "igst" REAL NOT NULL DEFAULT 0,
    "totalGst" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "deliveryCharge" REAL NOT NULL DEFAULT 0,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "amountDue" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "creditNoteRef" TEXT,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "taxableAmount" REAL NOT NULL,
    "gstRate" REAL NOT NULL,
    "cgst" REAL NOT NULL DEFAULT 0,
    "sgst" REAL NOT NULL DEFAULT 0,
    "igst" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "unit" TEXT,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dispatchNo" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "dispatchDate" DATETIME NOT NULL,
    "vehicleNo" TEXT,
    "deliveryMethod" TEXT,
    "trackingReference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispatches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "dispatches_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dispatch_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dispatchId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "dispatch_items_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentNo" TEXT NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "mode" TEXT NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "oldValues" TEXT,
    "newValues" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_customerId_key" ON "users"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "boms_productId_version_key" ON "boms"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bom_items_bomId_materialId_key" ON "bom_items"("bomId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_purchaseNo_key" ON "purchases"("purchaseNo");

-- CreateIndex
CREATE UNIQUE INDEX "stock_ledger_materialId_key" ON "stock_ledger"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_ledger_productId_key" ON "stock_ledger"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "production_runs_batchNo_key" ON "production_runs"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "orders_sellerId_status_idx" ON "orders"("sellerId", "status");

-- CreateIndex
CREATE INDEX "orders_marketplaceOrderId_idx" ON "orders"("marketplaceOrderId");

-- CreateIndex
CREATE INDEX "marketplace_orders_customerId_createdAt_idx" ON "marketplace_orders"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "order_status_events_orderId_createdAt_idx" ON "order_status_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_marketplaceOrderReference_idx" ON "notifications"("marketplaceOrderReference");

-- CreateIndex
CREATE INDEX "messages_senderId_receiverId_createdAt_idx" ON "messages"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_receiverId_readAt_createdAt_idx" ON "messages"("receiverId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNo_key" ON "invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_dispatchNo_key" ON "dispatches"("dispatchNo");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNo_key" ON "payments"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

