# Repost Item Valuation Framework


## Document Information

| Property               | Value                                       |
|------------------------|---------------------------------------------|
| Document               | repost_technical_analysis.md                |
| ERPNext Version        | v16                                         |
| Branch                 | version-16                                  |
| Module                 | Stock                                       |
| Primary File           | stock_ledger.py                             |
| Primary Class          | update_entries_after                        |
| Audience               | ERPNext Architects & Developers             |
| Application            | Avian                                       |

---

## 1. Introduction

This document analyzes the internal ERPNext v16 reposting engine at source-code level.

Unlike the previous document (`repost_analysis.md`) which focused on functional behavior, this document focuses on:

- Source Code Architecture
- Class Hierarchy
- Method Call Hierarchy
- SQL Processing
- Valuation Algorithms
- FIFO Internals
- Moving Average Internals
- Reposting Internals
- Extension Points

---

## 2. High-Level Architecture

*(Architecture overview – the system is composed of a Repost Controller, Stock Valuation Engine, and Accounting Engine as detailed below.)*

---

## 3. Major Source Files

### Repost Controller

```text
erpnext/
└── stock/
    └── doctype/
        └── repost_item_valuation/
            └── repost_item_valuation.py
```

### Stock Valuation Engine

```text
erpnext/
└── stock/
    └── stock_ledger.py
```

Contains:  
`class update_entries_after`

### Accounting Engine

```text
erpnext/
└── accounts/
    └── general_ledger.py
```

---

## 4. Core Runtime Hierarchy

The runtime flow is:

```text
repost(doc)
  │
  ├── repost_sl_entries()
  │     │
  │     └── repost_future_sle()
  │           │
  │           └── update_entries_after()
  │                 ├── initialize_previous_data()
  │                 ├── build()
  │                 ├── get_sle_after_datetime()
  │                 ├── process_sle()
  │                 ├── update_outgoing_rate_on_transaction()
  │                 ├── get_moving_average_values()
  │                 └── update_bin()
  │
  └── repost_gl_entries()
```

---

## 5. Repost Item Valuation Controller

### Responsibility

The controller does **not** calculate valuation.  
Its responsibilities are:

- Create Repost Job
- Track Progress
- Identify Impact Scope
- Launch Replay
- Launch GL Rebuild

---

## 6. `repost_sl_entries()`

### Purpose

Determine impacted inventory.

Produces:

```json
{
    "item_code": "...",
    "warehouse": "...",
    "posting_date": "...",
    "posting_time": "..."
}
```

These become replay boundaries.

---

## 7. `repost_future_sle()`

### Purpose

Launch stock replay engine.

Typical behavior:

```python
update_entries_after(
    item_code,
    warehouse,
    posting_date,
    posting_time
)
```

One instance per **Item** + **Warehouse** combination.

---

## 8. `update_entries_after` Class

### Most Important Class

Everything related to valuation eventually flows through:

```python
class update_entries_after
```

This class is responsible for:

- Stock Replay
- FIFO Rebuild
- Moving Average Rebuild
- Valuation Rate Recalculation
- Stock Value Recalculation
- Bin Synchronization

---

## 9. Constructor Analysis

Instantiation:

```python
update_entries_after(...)
```

The constructor initializes:

- `self.item_code`
- `self.warehouse`
- `self.qty_after_transaction`
- `self.stock_value`
- `self.valuation_rate`
- `self.stock_queue`

and launches:

```python
self.build()
```

---

## 10. `build()`

### Purpose

Replay engine coordinator.

Flow:

```python
initialize_previous_data()
future_sles = get_sle_after_datetime()
for sle in future_sles:
    process_sle(sle)
update_bin()
```

---

## 11. `initialize_previous_data()`

### Purpose

Load inventory state immediately before replay start.

Provides:

- `opening_qty`
- `opening_stock_value`
- `opening_valuation_rate`
- `opening_stock_queue`

### SQL Pattern

```sql
SELECT *
FROM `tabStock Ledger Entry`
WHERE posting_datetime < replay_point
ORDER BY posting_datetime DESC
LIMIT 1
```

---

## 12. `get_sle_after_datetime()`

### Purpose

Load future ledger entries.

### SQL Pattern

```sql
SELECT *
FROM `tabStock Ledger Entry`
WHERE posting_datetime >= replay_point
ORDER BY
    posting_date,
    posting_time,
    creation,
    name
```

> **Order is critical.** Valuation depends on sequence.

---

## 13. `process_sle()`

### Core Valuation Router

Every future SLE passes through this method.

### Responsibilities

- Identify Transaction Type
- Determine Valuation Method
- Calculate Incoming Value
- Calculate Outgoing Value
- Update Queue
- Update Stock Value
- Update Valuation Rate

---

## 14. Transaction Types Handled

Examples:

- Purchase Receipt
- Purchase Invoice
- Stock Entry
- Delivery Note
- Stock Reconciliation
- Manufacturing Entry
- Purchase Return
- Sales Return

---

## 15. Incoming Transaction Flow

Example: **Purchase Receipt**

Processing:

1. Incoming Qty
2. Incoming Value
3. New Stock Value
4. New Valuation Rate

---

## 16. Outgoing Transaction Flow

Example: **Delivery Note**

Processing:

1. Determine Outgoing Rate
2. Calculate Outgoing Value
3. Reduce Stock Value
4. Update Queue

---

## 17. `get_incoming_outgoing_rate_from_transaction()`

### Purpose

Extract transaction rate from originating voucher.

Examples:

- Purchase Receipt Rate
- Purchase Invoice Rate
- Stock Entry Rate

### Output

Provides:

- `incoming_rate`
- `outgoing_rate`

to the valuation engine.

---

## 18. `update_outgoing_rate_on_transaction()`

### Purpose

Calculate inventory consumption valuation.

Used by:

- Delivery Note
- Material Issue
- Material Transfer
- Purchase Return
- Manufacturing Consumption

### Responsibilities

Update:

- `outgoing_rate`
- `stock_value_difference`
- `stock_value`

---

## 19. FIFO Example

Queue:

```text
[
    [100, 10],
    [100, 20]
]
```

Issue: **150 Qty**

Consumption:

- 100 @ 10
- 50 @ 20

Outgoing Value: **2000**  
Outgoing Rate: **13.3333**

---

## 20. `get_moving_average_values()`

### Purpose

Calculate moving average valuation.

### Formula

```text
(Current Stock Value + Incoming Value) / (Current Qty + Incoming Qty)
```

---

## 21. Example

Before:

- Qty = 100
- Value = 1000
- Rate = 10

Receipt: 100 Qty @ 20

After:

- Qty = 200
- Value = 3000
- Rate = 15

---

## 22. FIFO Queue Internals

Queue structure:

```text
[
    [qty, rate],
    [qty, rate]
]
```

Example:

```text
[
    [100, 10],
    [50,  12],
    [200, 15]
]
```

---

## 23. Queue Replay

Historical changes require **Queue Reconstruction**, not queue modification.  
ERPNext rebuilds the entire queue history.

---

## 24. Fields Recalculated Per SLE

- `qty_after_transaction`
- `valuation_rate`
- `stock_value`
- `stock_value_difference`
- `incoming_rate`
- `outgoing_rate`

---

## 25. `stock_value_difference`

Formula:

```text
Current Stock Value - Previous Stock Value
```

Used later by **GL Reposting**.

---

## 26. `update_bin()`

### Purpose

Synchronize current inventory state.

Table: `tabBin`

Updated:

- `actual_qty`
- `valuation_rate`
- `stock_value`
- `projected_qty`

---

## 27. Bin Synchronization Flow

*(Flow: SLE → Stock Value Recalculation → Bin Update)*

---

## 28. GL Reposting Engine

After stock replay, accounting must match inventory.  
ERPNext identifies vouchers whose `stock_value_difference` changed.

---

## 29. GL Reposting Flow

*(Flow: Stock Value Difference → Identify Affected Vouchers → Regenerate GL Entries)*

---

## 30. Voucher Controller Integration

ERPNext regenerates accounting using original controllers.

Examples:

- `PurchaseReceipt.make_gl_entries()`
- `StockEntry.make_gl_entries()`
- `DeliveryNote.make_gl_entries()`
- `PurchaseInvoice.make_gl_entries()`

---

## 31. Stock Entry Deep Dive

Types:

- Material Receipt
- Material Issue
- Material Transfer
- Manufacture
- Repack

All create SLEs. All participate in replay.

---

## 32. Manufacturing Deep Dive

Changes in **Raw Material Cost** cause changes in **Finished Goods Cost**, which propagate to:

- Future Deliveries
- Future Production
- COGS

---

## 33. SQL Debugging Guide

### SLE Inspection

```sql
SELECT
    posting_date,
    posting_time,
    actual_qty,
    valuation_rate,
    stock_value
FROM `tabStock Ledger Entry`
WHERE item_code='ITEM'
ORDER BY posting_date, posting_time;
```

### Bin Verification

```sql
SELECT *
FROM `tabBin`
WHERE item_code='ITEM';
```

### GL Verification

```sql
SELECT *
FROM `tabGL Entry`
WHERE voucher_no='STE-0001';
```

---

## 34. Performance Analysis

Large repost jobs may process **100k+ SLE rows**.

Important factors:

- Warehouse Count
- Item Count
- Posting Date Range
- FIFO Queue Size
- Database Indexes

---

## 35. Extension Points For Avian

Most useful methods:

- `get_incoming_outgoing_rate_from_transaction()`
- `update_outgoing_rate_on_transaction()`
- `get_moving_average_values()`

Because they influence valuation while preserving replay architecture.

---

## 36. Recommended Override Strategy

Prefer **Wrapper Override** instead of **Complete Method Replacement**.

Pattern:

```python
result = original_method()
apply_custom_logic()
return result
```

---

## 37. Architectural Conclusion

ERPNext v16 inventory valuation is fundamentally **Replay Based**.

The most important class in the valuation framework is:

> `erpnext.stock.stock_ledger.update_entries_after`

Everything else – `Repost Item Valuation`, `Stock Entry`, `Purchase Receipt`, `Purchase Invoice`, `GL Reposting` – ultimately feeds or consumes the results produced by this replay engine.
