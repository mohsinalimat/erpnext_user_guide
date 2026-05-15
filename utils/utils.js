/**
 * GPLv3 License
 * Copyright (C) Sanjay Kumar and Contributors
 */

frappe.provide("custom");
frappe.provide("custom.utils");
frappe.provide("custom.company");

/**
 * Safe operator mapping
 * Replaces dangerous eval()
 */
const CUSTOM_OPERATORS = {
    "===": (a, b) => a === b,
    "!==": (a, b) => a !== b,
    ">": (a, b) => a > b,
    "<": (a, b) => a < b,
    ">=": (a, b) => a >= b,
    "<=": (a, b) => a <= b,
};

$.extend(custom.utils, {

    /**
     * Get previous row from child table
     */
    get_previous_row(tablename, cdt, cdn) {

        const grid = cur_frm.fields_dict[tablename]?.grid;

        if (!grid || !grid.grid_rows) {
            return null;
        }

        const d = frappe.get_doc(cdt, cdn);

        if (!d || d.idx <= 1) {
            return null;
        }

        return grid.get_grid_row(cint(d.idx - 2));
    },

    /**
     * Get unique values from child table field
     */
    get_child_table_field_value_list(table, fieldname) {

        const values = new Set();

        (cur_frm.doc[table] || []).forEach(item => {

            if (item[fieldname]) {
                values.add(item[fieldname]);
            }
        });

        return [...values];
    },

    /**
     * Get previous linked documents from items table
     */
    get_item_prev_doc(doctype) {

        doctype = frappe.model.scrub(doctype);

        return this.get_child_table_field_value_list(
            "items",
            doctype
        );
    },

    /**
     * Sort child table rows safely
     */
    sort_child_table_based_on_field_name(
        table_name,
        field_name
    ) {

        const rows = cur_frm.doc[table_name] || [];

        rows.sort((a, b) => {

            const x = a[field_name];
            const y = b[field_name];

            // Numeric comparison
            if ($.isNumeric(x) && $.isNumeric(y)) {
                return flt(x) - flt(y);
            }

            // String comparison
            return String(x || "")
                .localeCompare(String(y || ""));
        });

        // Reset idx
        rows.forEach((row, index) => {
            row.idx = index + 1;
        });

        cur_frm.refresh_field(table_name);
    },

    /**
     * Hide group button
     */
    remove_group_button(label) {

        const btn = cur_frm.page
            .get_or_add_inner_group_button(label)
            ?.find("button");

        if (btn?.length) {
            btn.addClass("hide");
        }
    },

    /**
     * Update all child rows safely
     */
    async update_item_value(fieldname, value) {

        const items = cur_frm.doc.items || [];

        for (const item of items) {

            await frappe.model.set_value(
                item.doctype,
                item.name,
                fieldname,
                value
            );
        }

        cur_frm.refresh_field("items");
    },

    /**
     * Update value in other child rows
     */
    async update_value_in_other_item(
        cdn,
        fieldname,
        value
    ) {

        const items = cur_frm.doc.items || [];

        for (const item of items) {

            if (
                item.name !== cdn &&
                !item[fieldname]
            ) {

                await frappe.model.set_value(
                    item.doctype,
                    item.name,
                    fieldname,
                    value
                );
            }
        }

        cur_frm.refresh_field("items");
    },

    /**
     * Get field wrapper safely
     */
    get_field_wrapper(field_name) {

        return cur_frm.fields_dict[field_name]?.$wrapper;
    },

    /**
     * Set field background color
     */
    set_field_background_color(field_name, color) {

        const wrapper = this.get_field_wrapper(field_name);

        if (wrapper) {

            wrapper.find(
                ".control-input, .control-value"
            ).css(
                "background-color",
                color
            );
        }
    },

    /**
     * Set field text color
     */
    set_field_foreground_color(field_name, color) {

        const wrapper = this.get_field_wrapper(field_name);

        if (wrapper) {

            wrapper.find(
                ".control-input, .control-value"
            ).css(
                "color",
                color
            );
        }
    },

    /**
     * Get inner toolbar button
     */
    get_inner_button(label, group = null) {

        label = Array.isArray(label)
            ? label
            : [label];

        label = label.map(l => __(l));

        if (group) {

            const $group = cur_frm.page
                .get_inner_group_button(__(group));

            if ($group?.length) {

                return $group.find(
                    `.dropdown-menu li a[data-label="${encodeURIComponent(label)}"]`
                );
            }

            return null;
        }

        return cur_frm.page.inner_toolbar.find(
            `button[data-label="${encodeURIComponent(label)}"]`
        );
    },

    /**
     * Change button class
     */
    set_default_button_as_class(
        label,
        btnclass = "btn-primary"
    ) {

        const btn = this.get_inner_button(label);

        if (btn?.length) {

            btn.removeClass("btn-default")
                .addClass(btnclass);
        }
    },

    /**
     * Highlight grid rows safely
     * WITHOUT eval()
     */
    set_grid_row_background_color(
        table_name,
        field_name,
        field_value,
        operator = "===",
        color = "#ffe6e6"
    ) {

        const compare = CUSTOM_OPERATORS[operator];

        if (!compare) {

            frappe.throw(
                `Unsupported operator: ${operator}`
            );
        }

        const grid = cur_frm.fields_dict[table_name];

        grid.$wrapper.find(".grid-row").each(
            (i, row) => {

                const docname = $(row)
                    .attr("data-name");

                const d = locals[
                    grid.grid.doctype
                ][docname];

                if (!d) return;

                const matched = compare(
                    d[field_name],
                    field_value
                );

                if (matched) {

                    $(row)
                        .find(".grid-static-col")
                        .css(
                            "background-color",
                            color
                        );
                }
            }
        );
    },

    /**
     * Disable add row in child table
     */
    disable_add_row(tablename) {

        const field = cur_frm.get_field(tablename);

        if (!field) return;

        cur_frm.set_df_property(
            tablename,
            "allow_bulk_edit",
            0
        );

        cur_frm.set_df_property(
            tablename,
            "cannot_add_rows",
            1
        );

        cur_frm.set_df_property(
            tablename,
            "multiple_set",
            0
        );
    },

    /**
     * Toggle grid fields display
     */
    grid_toggle_display(
        tablename,
        fields,
        show = false
    ) {

        const grid =
            cur_frm.fields_dict[tablename]?.grid;

        if (!grid) return;

        fields.forEach(fname => {

            if (
                frappe.meta.get_docfield(
                    grid.doctype,
                    fname
                )
            ) {

                grid.toggle_display(
                    fname,
                    show
                );
            }
        });
    },

    /**
     * Copy values from previous row
     */
    async copy_value_from_previous_row(
        tablename,
        cdt,
        cdn,
        fields
    ) {

        const previous_row =
            this.get_previous_row(
                tablename,
                cdt,
                cdn
            );

        if (!previous_row) return;

        for (const fname of fields) {

            if (previous_row.doc[fname]) {

                await frappe.model.set_value(
                    cdt,
                    cdn,
                    fname,
                    previous_row.doc[fname]
                );
            }
        }

        cur_frm.refresh_field(tablename);
    },

    /**
     * Get previous row field value
     */
    get_value_from_previous_row(
        tablename,
        cdt,
        cdn,
        fieldname
    ) {

        const previous_row =
            this.get_previous_row(
                tablename,
                cdt,
                cdn
            );

        return previous_row?.doc?.[fieldname] || null;
    },

    /**
     * Sum child table field
     */
    sum(tablename, fieldname) {

        return frappe.utils.sum(
            (cur_frm.doc[tablename] || []).map(
                d => flt(d[fieldname])
            )
        );
    },
});

$.extend(custom.company, {

    _cache: {},

    /**
     * Get company document with caching
     */
    get_info(company) {

        company = company || cur_frm.doc.company;

        if (!company) {
            return {};
        }

        if (!this._cache[company]) {

            this._cache[company] = frappe.get_doc(
                ":Company",
                company
            );
        }

        return this._cache[company];
    },

    get_country(company) {
        return this.get_info(company).country;
    },

    get_region(company) {
        return this.get_info(company).region;
    },

    get_logo(company) {
        return this.get_info(company).company_logo;
    },

    get_stamp(company) {
        return this.get_info(company).company_stamp;
    },

    get_parent(company) {
        return this.get_info(company).parent_company;
    },

    is_group(company) {
        return this.get_info(company).is_group;
    },
});

$.extend(erpnext.utils, {

    /**
     * Hide naming series
     */
    toggle_naming_series() {

        cur_frm.toggle_display(
            "naming_series",
            false
        );
    },

    /**
     * Async fiscal year lookup
     */
    async get_fiscal_year(
        date = null,
        company = null
    ) {

        date = date ||
            frappe.datetime.get_today();

        company = company ||
            frappe.defaults.get_user_default(
                "Company"
            );

        const r = await frappe.call({
            method:
                "erpnext.accounts.utils.get_fiscal_year",
            args: {
                date,
                company,
            }
        });

        return r.message?.[0] || null;
    },

    /**
     * Set fiscal year in query report
     */
    async set_fiscal_year_in_query_report(
        query_report,
        company = null,
        date = null,
        fieldname = "fiscal_year"
    ) {

        const fiscal_year =
            await this.get_fiscal_year(
                date,
                company
            );

        query_report.set_filter_value(
            fieldname,
            fiscal_year
        );
    },
});