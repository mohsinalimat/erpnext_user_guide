# Frappe/ERPNext JavaScript Utils Functions

## Overview

This document provides a detailed of utility functions for ERPNext / Frappe.

[Source reviewed: ](utils/utils.js)

---

Namespaces:
- `custom.utils`
- `custom.company`
- `erpnext.utils`

---

# 1. get_previous_row()

## Description

Returns previous child table row object safely.

## Syntax

```javascript
custom.utils.get_previous_row(
    tablename,
    cdt,
    cdn
);
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| tablename | String | Child table fieldname |
| cdt | String | Child DocType |
| cdn | String | Child document name |

## Returns

```javascript
GridRow | null
```

## Example

```javascript
let prev_row = custom.utils.get_previous_row(
    "items",
    cdt,
    cdn
);
```

---

# 2. get_child_table_field_value_list()

## Description

Returns unique values from child table field.

## Example

```javascript
let warehouses =
    custom.utils.get_child_table_field_value_list(
        "items",
        "warehouse"
    );
```

---

# 3. get_item_prev_doc()

## Description

Returns unique linked document references from items table.

## Example

```javascript
let sales_orders =
    custom.utils.get_item_prev_doc(
        "sales_order"
    );
```

---

# 4. sort_child_table_based_on_field_name()

## Description

Sorts child table rows using numeric or string comparison.

## Example

```javascript
custom.utils.sort_child_table_based_on_field_name(
    "items",
    "item_code"
);
```

---

# 5. remove_group_button()

## Description

Hides grouped toolbar button.

## Example

```javascript
custom.utils.remove_group_button(
    "Create"
);
```

---

# 6. update_item_value()

## Description

Updates field value in all child rows safely using `frappe.model.set_value()`.

## Async Function

Yes

## Example

```javascript
await custom.utils.update_item_value(
    "warehouse",
    "Stores - TC"
);
```

---

# 7. update_value_in_other_item()

## Description

Updates field value in all rows except current row.

## Example

```javascript
await custom.utils.update_value_in_other_item(
    cdn,
    "cost_center",
    "Main - TC"
);
```

---

# 8. get_field_wrapper()

## Description

Returns field wrapper safely.

## Example

```javascript
let wrapper =
    custom.utils.get_field_wrapper(
        "posting_date"
    );
```

---

# 9. set_field_background_color()

## Description

Sets field background color.

## Example

```javascript
custom.utils.set_field_background_color(
    "posting_date",
    "#fff5cc"
);
```

---

# 10. set_field_foreground_color()

## Description

Sets field text color.

## Example

```javascript
custom.utils.set_field_foreground_color(
    "status",
    "red"
);
```

---

# 11. get_inner_button()

## Description

Returns inner toolbar button object.

## Example

```javascript
let btn =
    custom.utils.get_inner_button(
        "Submit"
    );
```

---

# 12. set_default_button_as_class()

## Description

Changes toolbar button class.

## Example

```javascript
custom.utils.set_default_button_as_class(
    "Submit",
    "btn-primary"
);
```

---

# 13. set_grid_row_background_color()

## Description

Highlights child table rows conditionally using safe operator mapping.

## Supported Operators

- ===
- !==
- >
- <
- >=
- <=

## Example

```javascript
custom.utils.set_grid_row_background_color(
    "items",
    "qty",
    0,
    "===",
    "#ffcccc"
);
```

---

# 14. disable_add_row()

## Description

Disables adding rows in child table.

## Example

```javascript
custom.utils.disable_add_row(
    "items"
);
```

---

# 15. grid_toggle_display()

## Description

Shows or hides child table fields dynamically.

## Example

```javascript
custom.utils.grid_toggle_display(
    "items",
    ["rate", "amount"],
    false
);
```

---

# 16. copy_value_from_previous_row()

## Description

Copies field values from previous row.

## Async Function

Yes

## Example

```javascript
await custom.utils.copy_value_from_previous_row(
    "items",
    cdt,
    cdn,
    ["warehouse", "uom"]
);
```

---

# 17. get_value_from_previous_row()

## Description

Returns field value from previous child row.

## Example

```javascript
let warehouse =
    custom.utils.get_value_from_previous_row(
        "items",
        cdt,
        cdn,
        "warehouse"
    );
```

---

# 18. sum()

## Description

Returns sum of child table field values.

## Example

```javascript
let total_qty =
    custom.utils.sum(
        "items",
        "qty"
    );
```

---

# Namespace: custom.company

---

# 19. get_info()

## Description

Returns cached company document.

## Example

```javascript
let company =
    custom.company.get_info();
```

---

# 20. get_country()

## Description

Returns company country.

---

# 21. get_region()

## Description

Returns company region.

---

# 22. get_logo()

## Description

Returns company logo.

---

# 23. get_stamp()

## Description

Returns company stamp.

---

# 24. get_parent()

## Description

Returns parent company.

---

# 25. is_group()

## Description

Checks whether company is group company.

## Returns

```javascript
Boolean
```

---

# Namespace: erpnext.utils

---

# 26. toggle_naming_series()

## Description

Hides naming series field.

## Example

```javascript
erpnext.utils.toggle_naming_series();
```

---

# 27. get_fiscal_year()

## Description

Returns fiscal year asynchronously.

## Example

```javascript
let fy =
    await erpnext.utils.get_fiscal_year();
```

---

# 28. set_fiscal_year_in_query_report()

## Description

Sets fiscal year automatically in query report filter.

## Example

```javascript
await erpnext.utils.set_fiscal_year_in_query_report(
    query_report
);
```

---

# ERPNext Compatibility

| ERPNext Version | Status |
|---|---|
| v13 | Supported |
| v14 | Recommended |
| v15 | Fully Compatible |
| v16 | Fully Compatible |
