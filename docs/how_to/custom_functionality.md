# How to add a custom button on child table

```
frappe.ui.form.on('Quotation', {
	refresh(frm) {
		frm.fields_dict["items"].grid.add_custom_button(__('Hello'), 
			function() {
				frappe.msgprint(__("Hello"));
        });
        frm.fields_dict["items"].grid.grid_buttons.find('.btn-custom')
        .removeClass('btn-default')
        .addClass('btn-primary');

	}
})

```

---

# How to get last idx of child table

```
frappe.get_list(“Vendor RFQ Response Item”,filters={“parent”:self.name,“idx”:-1},fields=[“make_quote”,“idx”])

```

