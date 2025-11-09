# Database Design

**Version:** 1.0.0  
**Date:** January 2025  
**Database Engine:** PostgreSQL 15+  
**Character Set:** UTF-8  
**Timezone:** UTC

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Schema Organization](#schema-organization)
4. [Core Domain](#core-domain)
5. [Commerce Domain](#commerce-domain)
6. [Voucher Domain](#voucher-domain)
7. [Logistics Domain](#logistics-domain)
8. [Shared Domain](#shared-domain)
9. [Data Types & Conventions](#data-types--conventions)
10. [Security & Compliance](#security--compliance)
11. [Performance Optimization](#performance-optimization)
12. [Migration Strategy](#migration-strategy)

---

## Overview

OmniPay is an e-commerce payment platform designed with **Domain-Driven Design (DDD)** principles. The database is structured to support both monolithic and microservices architectures through schema-based separation.

### Key Features

- ✅ **Multi-tenant ready**: Support multiple merchants
- ✅ **Audit trail**: Complete history of all changes
- ✅ **Soft delete**: Data recovery capabilities
- ✅ **Event sourcing ready**: Immutable transaction logs
- ✅ **Performance optimized**: Strategic indexes and partitioning-ready
- ✅ **Security first**: Row-level security and encryption support

---

## Architecture Principles

### 1. **Domain-Driven Design (DDD)**

The database follows DDD bounded contexts:
- **Core**: User identity and access management
- **Commerce**: Order and payment processing
- **Voucher**: Promotion and discount management
- **Logistics**: Shipping and fulfillment
- **Shared**: Cross-cutting concerns

### 2. **ACID Compliance**

All transactions follow ACID properties:
- **Atomicity**: All-or-nothing operations
- **Consistency**: Data integrity constraints
- **Isolation**: Concurrent transaction safety
- **Durability**: Permanent data storage

### 3. **Eventual Consistency**

For microservices migration:
- Immediate consistency within bounded contexts
- Eventual consistency across contexts
- Event-driven synchronization

### 4. **Immutability Pattern**

Critical tables are append-only:
- `account_transactions`: Never update, only insert
- `audit_logs`: Immutable audit trail
- `payment_webhooks`: Raw event storage

---

## Schema Organization

### Schema Structure

```
ommanipay_db/
├── core/          # User, Auth, Accounts (Identity & Access)
├── commerce/      # Products, Orders, Payments (Transactional)
├── voucher/       # Vouchers, Campaigns (Promotional)
├── logistics/     # Shipments, Tracking (Fulfillment)
└── shared/        # Notifications, Audit (Infrastructure)
```

### Why Schema Separation?

| Benefit | Description |
|---------|-------------|
| **Logical Isolation** | Clear domain boundaries |
| **Access Control** | Fine-grained permissions per schema |
| **Migration Ready** | Easy to split into separate databases |
| **Team Autonomy** | Different teams own different schemas |
| **Performance** | Independent scaling and optimization |

---

## Core Domain

### Purpose
Manages **user identity, authentication, authorization, and account balances**.

---

### Table: `core.users`

**Purpose:** Central user repository for all system users (customers, merchants, admins).

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier (v4 UUID) |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Login email, indexed |
| `phone` | VARCHAR(20) | UNIQUE | Phone number for 2FA |
| `password_hash` | VARCHAR(255) | NOT NULL | BCrypt hashed password (cost=10) |
| `full_name` | VARCHAR(255) | NOT NULL | User's full name |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, BLOCKED |
| `created_at` | TIMESTAMP | NOT NULL | Account creation time (UTC) |
| `updated_at` | TIMESTAMP | NOT NULL | Last profile update (UTC) |
| `created_by` | UUID | FK → users(id) | Admin who created (for merchant accounts) |
| `updated_by` | UUID | FK → users(id) | Last admin who modified |

#### Business Rules

1. **Email Validation**: Must be valid RFC 5322 format
2. **Password Policy**: Minimum 8 characters, complexity required
3. **Status Transitions**:
   - `ACTIVE → INACTIVE`: User deactivation
   - `ACTIVE → BLOCKED`: Security violation
   - `BLOCKED → ACTIVE`: Admin review required

#### Indexes

```sql
CREATE INDEX idx_users_email ON core.users(email);              -- Login lookup
CREATE INDEX idx_users_phone ON core.users(phone);              -- 2FA lookup
CREATE INDEX idx_users_status ON core.users(status);            -- Filter active users
CREATE INDEX idx_users_created_at ON core.users(created_at DESC); -- Recent users
```

#### Security Considerations

- ⚠️ **Never log `password_hash`** in application logs
- 🔒 Use **BCrypt** with cost factor ≥ 10
- 🔑 Implement **email verification** before activation
- 📱 Support **phone verification** for sensitive operations

---

### Table: `core.user_roles`

**Purpose:** Role-Based Access Control (RBAC) for authorization.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users(id), NOT NULL | User reference |
| `role` | ENUM | NOT NULL | CUSTOMER, MERCHANT, ADMIN |
| `created_at` | TIMESTAMP | NOT NULL | Role assignment time |

#### Business Rules

1. **Multiple Roles**: A user can have multiple roles
   - Example: User can be both CUSTOMER and MERCHANT
2. **Unique Constraint**: `(user_id, role)` prevents duplicate assignments
3. **No Deletion**: Use audit log for role changes

#### Role Definitions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **CUSTOMER** | Place orders, manage profile | Regular buyers |
| **MERCHANT** | Create products, view sales | Sellers |
| **ADMIN** | Full system access | Platform operators |

---

### Table: `core.accounts`

**Purpose:** User wallet/account for holding balance (internal payment system).

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users(id), NOT NULL | Account owner |
| `account_number` | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable account number |
| `account_type` | ENUM | NOT NULL | PERSONAL, BUSINESS |
| `balance` | DECIMAL(19,4) | NOT NULL, ≥ 0 | Current balance (4 decimals) |
| `currency` | ENUM | NOT NULL, DEFAULT 'VND' | VND, USD |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, FROZEN, CLOSED |
| `created_at` | TIMESTAMP | NOT NULL | Account creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last balance update |

#### Business Rules

1. **Account Number Format**: `ACC-{YEAR}-{RANDOM8}`
   - Example: `ACC-2025-A1B2C3D4`
2. **Balance Constraints**:
   - Cannot be negative (database constraint)
   - Check available balance before debit
3. **Status Transitions**:
   - `ACTIVE → FROZEN`: Fraud detection
   - `FROZEN → ACTIVE`: Admin review
   - `ACTIVE → CLOSED`: User request (irreversible)
4. **Multi-Currency**: Each user can have multiple accounts (different currencies)

#### Financial Integrity

```sql
-- Ensure balance is always non-negative
CONSTRAINT chk_balance CHECK (balance >= 0)

-- Concurrent update protection
UPDATE accounts 
SET balance = balance - :amount, 
    updated_at = CURRENT_TIMESTAMP,
    version = version + 1  -- Optimistic locking
WHERE id = :account_id 
  AND balance >= :amount   -- Available balance check
  AND version = :expected_version;
```

---

### Table: `core.account_transactions`

**Purpose:** Immutable ledger of all account balance changes (Event Sourcing).

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `account_id` | UUID | FK → accounts(id), NOT NULL | Account reference |
| `reference_id` | UUID | NULL | Link to order/payment/refund |
| `reference_type` | ENUM | NULL | ORDER, PAYMENT, REFUND, TOPUP, WITHDRAWAL |
| `transaction_type` | ENUM | NOT NULL | CREDIT, DEBIT |
| `amount` | DECIMAL(19,4) | NOT NULL, > 0 | Transaction amount |
| `balance_before` | DECIMAL(19,4) | NOT NULL | Balance snapshot before |
| `balance_after` | DECIMAL(19,4) | NOT NULL | Balance snapshot after |
| `description` | TEXT | NULL | Human-readable description |
| `created_at` | TIMESTAMP | NOT NULL | Transaction time (immutable) |

#### Business Rules

1. **Immutability**: ⚠️ **NO UPDATE OR DELETE** allowed
   ```sql
   REVOKE UPDATE, DELETE ON core.account_transactions FROM app_user;
   ```
2. **Double-Entry Bookkeeping**:
   - Every debit has a corresponding credit
   - `balance_after = balance_before ± amount`
3. **Idempotency**: Use `reference_id` to prevent duplicate transactions
4. **Audit Trail**: Full transaction history for forensics

#### Example Transaction Flow

```sql
-- User pays for order (DEBIT)
INSERT INTO account_transactions (
    account_id, reference_id, reference_type,
    transaction_type, amount,
    balance_before, balance_after, description
) VALUES (
    '...', 'order-uuid', 'ORDER',
    'DEBIT', 100000,
    500000, 400000, 'Payment for Order #ORD-2025-XXXX'
);

-- Merchant receives payment (CREDIT)
INSERT INTO account_transactions (
    account_id, reference_id, reference_type,
    transaction_type, amount,
    balance_before, balance_after, description
) VALUES (
    '...', 'order-uuid', 'ORDER',
    'CREDIT', 100000,
    1000000, 1100000, 'Received payment for Order #ORD-2025-XXXX'
);
```

---

## Commerce Domain

### Purpose
Manages **product catalog, orders, payments, and transaction processing**.

---

### Table: `commerce.products`

**Purpose:** Product catalog with inventory management.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `merchant_id` | UUID | FK → users(id), NOT NULL | Product owner |
| `sku` | VARCHAR(100) | UNIQUE, NOT NULL | Stock Keeping Unit |
| `name` | VARCHAR(500) | NOT NULL | Product name |
| `description` | TEXT | NULL | Detailed description |
| `price` | DECIMAL(19,4) | NOT NULL, ≥ 0 | Current selling price |
| `compare_at_price` | DECIMAL(19,4) | NULL, ≥ price | Original price (for discounts) |
| `stock_quantity` | INTEGER | NOT NULL, ≥ 0 | Available inventory |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, OUT_OF_STOCK |
| `metadata` | JSONB | NULL | Flexible attributes (color, size, etc.) |
| `created_at` | TIMESTAMP | NOT NULL | Product creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last update time |

#### Business Rules

1. **SKU Format**: `{CATEGORY}-{YEAR}-{RANDOM6}`
   - Example: `ELECTRONICS-2025-A1B2C3`
2. **Price Validation**:
   - `compare_at_price` must be ≥ `price` (show discount)
3. **Stock Management**:
   - Auto-update status to `OUT_OF_STOCK` when `stock_quantity = 0`
4. **Metadata Schema** (JSONB):
   ```json
   {
     "color": "Red",
     "size": "M",
     "weight": "0.5kg",
     "dimensions": "10x20x5cm"
   }
   ```

#### Inventory Deduction Pattern

```sql
-- Optimistic locking for concurrent orders
UPDATE products 
SET stock_quantity = stock_quantity - :quantity,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :product_id 
  AND stock_quantity >= :quantity  -- Prevent overselling
  AND status = 'ACTIVE';

-- Check affected rows
IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Insufficient stock or inactive product';
END IF;
```

---

### Table: `commerce.orders`

**Purpose:** Customer orders with complete lifecycle tracking.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `order_number` | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable order ID |
| `customer_id` | UUID | FK → users(id), NOT NULL | Buyer reference |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | Order status (see below) |
| `subtotal` | DECIMAL(19,4) | NOT NULL, ≥ 0 | Sum of order items |
| `discount_amount` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Voucher discount |
| `shipping_fee` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Delivery cost |
| `tax_amount` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Sales tax (VAT) |
| `total_amount` | DECIMAL(19,4) | NOT NULL, ≥ 0 | Final amount to pay |
| `voucher_id` | UUID | FK → vouchers(id), NULL | Applied voucher |
| `shipping_address` | TEXT | NOT NULL | Delivery address (JSON) |
| `billing_address` | TEXT | NOT NULL | Billing address (JSON) |
| `notes` | TEXT | NULL | Customer notes |
| `created_at` | TIMESTAMP | NOT NULL | Order creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last status update |
| `confirmed_at` | TIMESTAMP | NULL | Payment confirmed time |
| `cancelled_at` | TIMESTAMP | NULL | Cancellation time |

#### Order Status Flow

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   ↓
CANCELLED (can happen at PENDING or CONFIRMED stages)
```

| Status | Description | Actions Allowed |
|--------|-------------|-----------------|
| **PENDING** | Order created, awaiting payment | Cancel, Pay |
| **CONFIRMED** | Payment received | Cancel (with refund), Process |
| **PROCESSING** | Being prepared | Ship |
| **SHIPPED** | In delivery | Track |
| **DELIVERED** | Completed | Review, Return |
| **CANCELLED** | Cancelled by user/admin | None |

#### Business Rules

1. **Order Number Format**: `ORD-{YYYYMMDD}-{RANDOM6}`
   - Example: `ORD-20250115-A1B2C3`
2. **Total Calculation**:
   ```
   total_amount = subtotal - discount_amount + shipping_fee + tax_amount
   ```
3. **Cancellation Rules**:
   - Before PROCESSING: Full refund
   - After SHIPPED: Return process required
4. **Address Format** (TEXT stored as JSON):
   ```json
   {
     "recipient": "Nguyen Van A",
     "phone": "+84901234567",
     "street": "123 Nguyen Hue",
     "city": "Ho Chi Minh",
     "district": "District 1",
     "postal_code": "700000"
   }
   ```

---

### Table: `commerce.order_items`

**Purpose:** Line items in each order (Snapshot Pattern).

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `order_id` | UUID | FK → orders(id), NOT NULL | Parent order |
| `product_id` | UUID | FK → products(id), NOT NULL | Product reference |
| `product_name` | VARCHAR(500) | NOT NULL | **Snapshot** at order time |
| `unit_price` | DECIMAL(19,4) | NOT NULL, ≥ 0 | **Snapshot** at order time |
| `quantity` | INTEGER | NOT NULL, > 0 | Quantity ordered |
| `subtotal` | DECIMAL(19,4) | NOT NULL, ≥ 0 | unit_price × quantity |
| `discount_amount` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Item-level discount |
| `total_amount` | DECIMAL(19,4) | NOT NULL, ≥ 0 | subtotal - discount_amount |

#### Why Snapshot Pattern?

**Problem:** Product details can change after order is placed.

**Solution:** Store product snapshot in `order_items`:
- ✅ `product_name`: Current name at order time
- ✅ `unit_price`: Current price at order time
- ✅ `product_id`: Reference to original product (for analytics)

**Benefits:**
- Order history remains accurate even if product is deleted
- Invoices show correct historical prices
- No FK cascade issues

---

### Table: `commerce.payments`

**Purpose:** Payment transactions with external gateway integration.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `order_id` | UUID | FK → orders(id), NOT NULL | Related order |
| `payment_number` | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable payment ID |
| `payer_id` | UUID | FK → users(id), NOT NULL | Who paid |
| `payment_method` | ENUM | NOT NULL | STRIPE, VNPAY, WALLET, COD |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | Payment status |
| `amount` | DECIMAL(19,4) | NOT NULL, > 0 | Payment amount |
| `currency` | ENUM | NOT NULL, DEFAULT 'VND' | VND, USD |
| `gateway_transaction_id` | VARCHAR(255) | NULL | External payment ID |
| `gateway_response` | TEXT | NULL | Raw response from gateway |
| `authorized_at` | TIMESTAMP | NULL | Authorization time |
| `captured_at` | TIMESTAMP | NULL | Money captured time |
| `failed_at` | TIMESTAMP | NULL | Failure time |
| `refunded_at` | TIMESTAMP | NULL | Refund time |
| `failure_reason` | TEXT | NULL | Error message |
| `created_at` | TIMESTAMP | NOT NULL | Payment initiation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last status update |

#### Payment Status Flow

```
PENDING → AUTHORIZED → CAPTURED
   ↓           ↓
 FAILED     REFUNDED
```

| Status | Description | Meaning |
|--------|-------------|---------|
| **PENDING** | Payment initiated | Waiting for gateway response |
| **AUTHORIZED** | Funds reserved | Money held, not captured yet |
| **CAPTURED** | Payment completed | Money transferred to merchant |
| **FAILED** | Payment failed | Retry or use different method |
| **REFUNDED** | Money returned | Full or partial refund |

#### Payment Methods

| Method | Description | When Captured |
|--------|-------------|---------------|
| **STRIPE** | Credit/Debit card | Immediately or delayed |
| **VNPAY** | Vietnamese payment gateway | After QR scan |
| **WALLET** | OmniPay internal balance | Immediately |
| **COD** | Cash on delivery | At delivery time |

#### Idempotency Pattern

```sql
-- Prevent duplicate payment processing
INSERT INTO payments (...)
VALUES (...)
ON CONFLICT (gateway_transaction_id) 
DO UPDATE SET status = EXCLUDED.status;
```

---

### Table: `commerce.payment_webhooks`

**Purpose:** Store raw webhook events from payment gateways for debugging and reprocessing.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `provider` | ENUM | NOT NULL | STRIPE, VNPAY |
| `event_type` | VARCHAR(100) | NOT NULL | payment.success, payment.failed |
| `payload` | TEXT | NOT NULL | Raw JSON from gateway |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, PROCESSED, FAILED |
| `received_at` | TIMESTAMP | NOT NULL | Webhook received time |
| `processed_at` | TIMESTAMP | NULL | Processing completion time |

#### Business Rules

1. **Immutability**: Never update `payload` or `received_at`
2. **Retry Logic**: Re-process FAILED webhooks with exponential backoff
3. **Signature Verification**: Validate webhook authenticity before processing
4. **Idempotency**: Use `gateway_transaction_id` to prevent duplicate processing

---

## Voucher Domain

### Purpose
Manages **discount vouchers, campaigns, and promotion tracking**.

---

### Table: `voucher.vouchers`

**Purpose:** Discount codes with usage limits and validity periods.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Voucher code (SUMMER2025) |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `description` | TEXT | NULL | Terms and conditions |
| `discount_type` | ENUM | NOT NULL | PERCENTAGE, FIXED_AMOUNT |
| `discount_value` | DECIMAL(19,4) | NOT NULL, > 0 | 10 (10%) or 100000 (100k VND) |
| `min_order_value` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Minimum order to apply |
| `max_discount_amount` | DECIMAL(19,4) | NULL | Cap for percentage discount |
| `usage_limit` | INTEGER | NULL | Total times can be used |
| `usage_count` | INTEGER | NOT NULL, DEFAULT 0 | Current usage count |
| `usage_per_user` | INTEGER | NOT NULL, DEFAULT 1 | Max times per user |
| `valid_from` | TIMESTAMP | NOT NULL | Start date |
| `valid_to` | TIMESTAMP | NOT NULL | End date |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, EXPIRED |
| `created_at` | TIMESTAMP | NOT NULL | Voucher creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last update time |

#### Business Rules

1. **Code Format**: Alphanumeric, 6-20 characters, uppercase
   - Examples: `SUMMER2025`, `WELCOME50`, `FLASH25`
2. **Discount Calculation**:
   ```java
   if (discount_type == PERCENTAGE) {
       discount = min(order_total * discount_value / 100, max_discount_amount);
   } else {
       discount = discount_value;
   }
   ```
3. **Validation Rules**:
   - Check: `CURRENT_TIMESTAMP BETWEEN valid_from AND valid_to`
   - Check: `usage_count < usage_limit` (if limit exists)
   - Check: `order_total >= min_order_value`
   - Check: User usage count < `usage_per_user`

#### Concurrency Control

```sql
-- Increment usage count with optimistic locking
UPDATE vouchers 
SET usage_count = usage_count + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE code = :code 
  AND status = 'ACTIVE'
  AND CURRENT_TIMESTAMP BETWEEN valid_from AND valid_to
  AND (usage_limit IS NULL OR usage_count < usage_limit);

-- Check affected rows
IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Voucher invalid or limit exceeded';
END IF;
```

---

## Logistics Domain

### Purpose
Manages **shipping, delivery tracking, and carrier integration**.

---

### Table: `logistics.shipments`

**Purpose:** Shipment information with carrier integration.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `order_id` | UUID | FK → orders(id), NOT NULL | Related order |
| `tracking_number` | VARCHAR(50) | UNIQUE, NOT NULL | Internal tracking ID |
| `carrier` | ENUM | NOT NULL | GHTK, GHN, VIETTEL_POST, etc. |
| `carrier_tracking_id` | VARCHAR(255) | NULL | External tracking ID |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | Shipment status |
| `pickup_address` | TEXT | NOT NULL | Warehouse address |
| `delivery_address` | TEXT | NOT NULL | Customer address |
| `shipping_fee` | DECIMAL(19,4) | NOT NULL, ≥ 0 | Delivery cost |
| `cod_amount` | DECIMAL(19,4) | NOT NULL, DEFAULT 0 | Cash on delivery |
| `estimated_delivery` | TIMESTAMP | NULL | ETA |
| `actual_delivery` | TIMESTAMP | NULL | Actual delivery time |
| `notes` | TEXT | NULL | Special instructions |
| `created_at` | TIMESTAMP | NOT NULL | Shipment creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last status update |

#### Shipment Status Flow

```
PENDING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
   ↓
FAILED → RETURNED
```

---

## Shared Domain

### Purpose
Cross-cutting concerns: **notifications, audit logs, system configurations**.

---

### Table: `shared.notifications`

**Purpose:** Multi-channel notifications (email, SMS, push).

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users(id), NOT NULL | Recipient |
| `type` | ENUM | NOT NULL | EMAIL, SMS, PUSH, IN_APP |
| `subject` | VARCHAR(500) | NULL | Email subject |
| `content` | TEXT | NOT NULL | Message body |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, SENT, FAILED |
| `metadata` | JSONB | NULL | Template variables |
| `sent_at` | TIMESTAMP | NULL | Delivery time |
| `created_at` | TIMESTAMP | NOT NULL | Creation time |

---

### Table: `shared.audit_logs`

**Purpose:** Complete audit trail for compliance and debugging.

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `user_id` | UUID | FK → users(id), NULL | Who performed action |
| `entity_type` | VARCHAR(100) | NOT NULL | ORDERS, PAYMENTS, PRODUCTS |
| `entity_id` | UUID | NOT NULL | ID of modified entity |
| `action` | ENUM | NOT NULL | CREATE, UPDATE, DELETE |
| `old_values` | JSONB | NULL | Before state (UPDATE/DELETE) |
| `new_values` | JSONB | NULL | After state (CREATE/UPDATE) |
| `ip_address` | VARCHAR(45) | NULL | IPv4/IPv6 address |
| `user_agent` | TEXT | NULL | Browser/client info |
| `created_at` | TIMESTAMP | NOT NULL | Action timestamp |

#### Business Rules

1. **Immutability**: ⚠️ **NO UPDATE OR DELETE** allowed
2. **Compliance**: Required for GDPR, PCI DSS, SOC 2
3. **Retention**: Keep for 7 years (financial regulations)

---

## Data Types & Conventions

### Primary Keys

- **Type**: `UUID` (RFC 4122 v4)
- **Why**: 
  - Globally unique (no collisions)
  - Merge-friendly (no ID conflicts)
  - Security (non-sequential, unpredictable)

### Timestamps

- **Type**: `TIMESTAMP WITH TIME ZONE`
- **Timezone**: Always store in UTC
- **Display**: Convert to user timezone in application layer

### Money Amounts

- **Type**: `DECIMAL(19, 4)`
- **Precision**: 19 digits total, 4 decimals
- **Why**: Avoid floating-point errors
- **Example**: `123456789012345.6789`

### Enums

- **Implementation**: `VARCHAR` with `CHECK` constraint
- **Why**: Easier to add new values (no schema migration)
- **Example**:
  ```sql
  status VARCHAR(20) CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED'))
  ```

### JSON Columns

- **Type**: `JSONB` (binary JSON, indexed)
- **Use Cases**: Flexible attributes, metadata
- **Indexing**:
  ```sql
  CREATE INDEX idx_products_metadata ON products USING gin(metadata);
  ```

---

## Security & Compliance

### Encryption

- **At Rest**: Database-level encryption (TDE)
- **In Transit**: TLS 1.3 for connections
- **Sensitive Fields**: 
  - `password_hash`: BCrypt (never decrypt)
  - `gateway_response`: May contain card details (PCI DSS)

### Access Control

```sql
-- Create role with minimal permissions
CREATE ROLE app_user;
GRANT SELECT, INSERT, UPDATE ON core.users TO app_user;
GRANT SELECT, INSERT ON shared.audit_logs TO app_user;
REVOKE UPDATE, DELETE ON shared.audit_logs FROM app_user;
```

### Data Retention

| Table | Retention Period | Reason |
|-------|------------------|--------|
| `audit_logs` | 7 years | Financial regulations |
| `payments` | 10 years | Tax compliance |
| `orders` | 5 years | Consumer protection |
| `notifications` | 1 year | Operational |

---

## Performance Optimization

### Indexing Strategy

```sql
-- B-tree indexes for equality/range queries
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_active_products ON products(id) WHERE status = 'ACTIVE';

-- Composite indexes for multi-column queries
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- GIN indexes for JSONB
CREATE INDEX idx_products_metadata ON products USING gin(metadata);

-- Full-text search
CREATE INDEX idx_products_name_fts ON products USING gin(to_tsvector('english', name));
```

### Partitioning (Future)

```sql
-- Partition orders by created_at (monthly)
CREATE TABLE orders (
    id UUID,
    created_at TIMESTAMP,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2025_01 PARTITION OF orders
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE orders_2025_02 PARTITION OF orders
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

### Query Optimization Tips

```sql
-- ❌ Bad: Slow full table scan
SELECT * FROM orders WHERE customer_id = '...';

-- ✅ Good: Use indexed column
SELECT id, order_number, status, total_amount 
FROM orders 
WHERE customer_id = '...' 
  AND created_at > NOW() - INTERVAL '30 days';

-- ❌ Bad: Function on indexed column
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';

-- ✅ Good: Use lowercase in application
SELECT * FROM users WHERE email = 'test@example.com';
```

### Connection Pooling

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # Max connections
      minimum-idle: 5            # Min idle connections
      connection-timeout: 30000  # 30 seconds
      idle-timeout: 600000       # 10 minutes
      max-lifetime: 1800000      # 30 minutes
```

---

## Migration Strategy

### Phase 1: Monolith Setup

```bash
# Run schema creation
psql -U postgres -d ommanipay_db -f schema.sql

# Verify schemas
\dn

# Verify tables
\dt core.*
\dt commerce.*
\dt voucher.*
\dt logistics.*
\dt shared.*
```

### Phase 2: Microservices Preparation

#### Step 1: Create Separate Databases

```sql
-- Create databases for each service
CREATE DATABASE core_db;
CREATE DATABASE commerce_db;
CREATE DATABASE voucher_db;
CREATE DATABASE logistics_db;
```

#### Step 2: Export Schema by Domain

```bash
# Export core schema
pg_dump -U postgres -d ommanipay_db \
  --schema=core \
  --schema-only \
  -f core_schema.sql

# Export commerce schema
pg_dump -U postgres -d ommanipay_db \
  --schema=commerce \
  --schema-only \
  -f commerce_schema.sql

# Similar for voucher and logistics
```

#### Step 3: Migrate Data

```bash
# Export data from core schema
pg_dump -U postgres -d ommanipay_db \
  --schema=core \
  --data-only \
  --column-inserts \
  -f core_data.sql

# Import to new database
psql -U postgres -d core_db -f core_schema.sql
psql -U postgres -d core_db -f core_data.sql
```

#### Step 4: Remove Foreign Keys Across Schemas

```sql
-- In commerce_db, remove FK to core.users
ALTER TABLE orders DROP CONSTRAINT fk_orders_customer;

-- Add application-level validation instead
-- Check user exists via Core Service API before creating order
```

### Phase 3: Data Consistency Testing

```sql
-- Compare record counts
SELECT 'core.users' as table_name, COUNT(*) FROM core.users
UNION ALL
SELECT 'core_db.users', COUNT(*) FROM core_db.users;

-- Verify referential integrity
SELECT o.id, o.customer_id
FROM commerce.orders o
LEFT JOIN core.users u ON o.customer_id = u.id
WHERE u.id IS NULL;  -- Should return 0 rows
```

---

## Naming Conventions

### Tables

- **Format**: `snake_case`, plural nouns
- **Examples**: `users`, `order_items`, `payment_webhooks`

### Columns

- **Format**: `snake_case`
- **Examples**: `created_at`, `customer_id`, `total_amount`

### Indexes

- **Format**: `idx_{table}_{column(s)}`
- **Examples**: 
  - `idx_users_email`
  - `idx_orders_customer_status`
  - `idx_products_name_fts` (full-text search)

### Foreign Keys

- **Format**: `fk_{table}_{referenced_table}`
- **Examples**: 
  - `fk_orders_customer`
  - `fk_payments_order`

### Constraints

- **Format**: `chk_{table}_{description}`
- **Examples**: 
  - `chk_accounts_balance` (balance >= 0)
  - `chk_vouchers_valid_dates` (valid_to > valid_from)

---

## Database Maintenance

### Vacuum & Analyze

```sql
-- Regular maintenance (run daily)
VACUUM ANALYZE core.users;
VACUUM ANALYZE commerce.orders;
VACUUM ANALYZE commerce.payments;

-- Full vacuum (run monthly, requires exclusive lock)
VACUUM FULL core.account_transactions;
```

### Reindexing

```sql
-- Rebuild indexes to improve performance
REINDEX TABLE commerce.orders;
REINDEX INDEX idx_orders_customer_id;

-- Reindex concurrently (no locks)
REINDEX INDEX CONCURRENTLY idx_orders_created_at;
```

### Statistics Update

```sql
-- Update query planner statistics
ANALYZE commerce.orders;
ANALYZE commerce.products;
```

### Backup Strategy

```bash
# Daily backup (all databases)
pg_dump -U postgres ommanipay_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Weekly full backup with schema
pg_dump -U postgres -F c -b -v -f ommanipay_weekly.backup ommanipay_db

# Point-in-time recovery (WAL archiving)
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
```

---

## Monitoring & Alerts

### Key Metrics

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('ommanipay_db'));

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname IN ('core', 'commerce', 'voucher', 'logistics')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,  -- Number of times used
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Unused indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Active connections
SELECT 
    datname,
    COUNT(*) as connections,
    MAX(query_start) as last_query
FROM pg_stat_activity
GROUP BY datname;
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| **Connection count** | 70% | 90% | Scale up connection pool |
| **Database size** | 80 GB | 90 GB | Partition old data |
| **Query time** | > 1s | > 5s | Optimize query |
| **Replication lag** | > 5s | > 30s | Check network |
| **Deadlocks** | > 5/hour | > 20/hour | Review transaction logic |

---

## Common Query Patterns

### Customer Order History

```sql
SELECT 
    o.order_number,
    o.status,
    o.total_amount,
    o.created_at,
    COUNT(oi.id) as item_count,
    p.status as payment_status
FROM commerce.orders o
LEFT JOIN commerce.order_items oi ON oi.order_id = o.id
LEFT JOIN commerce.payments p ON p.order_id = o.id
WHERE o.customer_id = :customer_id
GROUP BY o.id, p.status
ORDER BY o.created_at DESC
LIMIT 20;
```

### Merchant Sales Report

```sql
SELECT 
    DATE_TRUNC('day', o.created_at) as date,
    COUNT(o.id) as order_count,
    SUM(o.total_amount) as revenue,
    AVG(o.total_amount) as avg_order_value
FROM commerce.orders o
JOIN commerce.order_items oi ON oi.order_id = o.id
JOIN commerce.products p ON p.id = oi.product_id
WHERE p.merchant_id = :merchant_id
  AND o.status IN ('DELIVERED', 'SHIPPED')
  AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', o.created_at)
ORDER BY date DESC;
```

### Low Stock Alert

```sql
SELECT 
    p.id,
    p.sku,
    p.name,
    p.stock_quantity,
    COUNT(oi.id) as sales_last_7_days
FROM commerce.products p
LEFT JOIN commerce.order_items oi ON oi.product_id = p.id
    AND oi.order_id IN (
        SELECT id FROM commerce.orders 
        WHERE created_at >= NOW() - INTERVAL '7 days'
    )
WHERE p.stock_quantity < 10
  AND p.status = 'ACTIVE'
GROUP BY p.id
ORDER BY p.stock_quantity ASC;
```

### Voucher Performance

```sql
SELECT 
    v.code,
    v.name,
    v.usage_count,
    v.usage_limit,
    COUNT(DISTINCT vu.user_id) as unique_users,
    SUM(vu.discount_amount) as total_discount_given,
    COUNT(o.id) as orders_with_voucher,
    SUM(o.total_amount) as total_revenue
FROM voucher.vouchers v
JOIN voucher.voucher_usage vu ON vu.voucher_id = v.id
JOIN commerce.orders o ON o.id = vu.order_id
WHERE v.valid_from >= NOW() - INTERVAL '30 days'
GROUP BY v.id
ORDER BY total_revenue DESC;
```

### Account Transaction History

```sql
SELECT 
    at.transaction_type,
    at.amount,
    at.balance_after,
    at.description,
    at.created_at,
    CASE 
        WHEN at.reference_type = 'ORDER' THEN 
            (SELECT order_number FROM commerce.orders WHERE id = at.reference_id)
        WHEN at.reference_type = 'PAYMENT' THEN
            (SELECT payment_number FROM commerce.payments WHERE id = at.reference_id)
    END as reference_number
FROM core.account_transactions at
WHERE at.account_id = :account_id
ORDER BY at.created_at DESC
LIMIT 50;
```

---

## Troubleshooting Guide

### Issue: Slow ORDER queries

**Symptom**: Queries on `commerce.orders` taking > 1 second

**Diagnosis**:
```sql
EXPLAIN ANALYZE 
SELECT * FROM commerce.orders 
WHERE customer_id = '...' 
  AND status = 'PENDING';
```

**Solutions**:
1. Add composite index: `CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);`
2. Partition table by `created_at` if > 1M records
3. Archive old orders (> 2 years) to separate table

---

### Issue: Deadlocks on PAYMENTS table

**Symptom**: `ERROR: deadlock detected`

**Diagnosis**:
```sql
SELECT * FROM pg_stat_database WHERE datname = 'ommanipay_db';
-- Check deadlocks column
```

**Solutions**:
1. Always acquire locks in consistent order (order → payment → account)
2. Use `SELECT ... FOR UPDATE SKIP LOCKED` for queue processing
3. Reduce transaction duration

---

### Issue: OUT OF STOCK not reflecting

**Symptom**: Products sold despite `stock_quantity = 0`

**Root Cause**: Race condition in concurrent orders

**Solution**:
```sql
-- Use optimistic locking
UPDATE products 
SET stock_quantity = stock_quantity - :qty,
    version = version + 1
WHERE id = :product_id 
  AND stock_quantity >= :qty
  AND version = :expected_version;

-- Check affected rows in application
```

---

## Development Best Practices

### 1. **Always Use Transactions**

```java
@Transactional
public Order placeOrder(OrderRequest request) {
    // All DB operations in single transaction
    Order order = orderRepository.save(new Order());
    updateStock(order);
    createPayment(order);
    return order;
}
```

### 2. **Handle Optimistic Locking**

```java
@Version
private Long version;  // JPA will check this

try {
    productRepository.save(product);
} catch (OptimisticLockException e) {
    // Retry or inform user
    throw new ConcurrentModificationException();
}
```

### 3. **Use Connection Pooling**

```properties
# Never create connections manually
spring.datasource.hikari.maximum-pool-size=20
```

### 4. **Avoid N+1 Queries**

```java
// ❌ Bad: N+1 query
List<Order> orders = orderRepository.findAll();
for (Order order : orders) {
    order.getOrderItems().size();  // Lazy load
}

// ✅ Good: Fetch join
@Query("SELECT o FROM Order o JOIN FETCH o.orderItems WHERE o.customerId = :id")
List<Order> findByCustomerIdWithItems(UUID id);
```

### 5. **Log SQL in Development**

```properties
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE
```

---

## Appendix

### A. SQL Functions Library

```sql
-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR AS $
BEGIN
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$ LANGUAGE plpgsql;

-- Check voucher validity
CREATE OR REPLACE FUNCTION is_voucher_valid(voucher_code VARCHAR, order_total DECIMAL)
RETURNS BOOLEAN AS $
DECLARE
    v RECORD;
BEGIN
    SELECT * INTO v FROM voucher.vouchers 
    WHERE code = voucher_code 
      AND status = 'ACTIVE'
      AND CURRENT_TIMESTAMP BETWEEN valid_from AND valid_to;
    
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF order_total < v.min_order_value THEN RETURN FALSE; END IF;
    IF v.usage_limit IS NOT NULL AND v.usage_count >= v.usage_limit THEN RETURN FALSE; END IF;
    
    RETURN TRUE;
END;
$ LANGUAGE plpgsql;
```

### B. Sample Data Generation

```sql
-- Insert sample users
INSERT INTO core.users (email, phone, password_hash, full_name, status)
SELECT 
    'user' || generate_series || '@example.com',
    '+8490' || LPAD(generate_series::TEXT, 7, '0'),
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'User ' || generate_series,
    'ACTIVE'
FROM generate_series(1, 100);

-- Insert sample products
INSERT INTO commerce.products (merchant_id, sku, name, price, stock_quantity, status)
SELECT 
    (SELECT id FROM core.users WHERE email LIKE '%@example.com' LIMIT 1),
    'PROD-' || generate_series,
    'Product ' || generate_series,
    RANDOM() * 1000000,
    FLOOR(RANDOM() * 100),
    'ACTIVE'
FROM generate_series(1, 1000);
```

### C. Health Check Queries

```sql
-- System health check
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 
    'Active Connections',
    COUNT(*)::TEXT
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
    'Cache Hit Ratio',
    ROUND(100 * sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0), 2)::TEXT || '%'
FROM pg_stat_database;
```

---

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-15 | Initial schema design | OmniPay Team |

---

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)
- [GDPR Requirements](https://gdpr.eu/)
- [Microservices Database Patterns](https://microservices.io/patterns/data/database-per-service.html)

---

**Document Status:** ✅ Production Ready  
**Last Updated:** January 15, 2025  
**Next Review:** April 15, 2025