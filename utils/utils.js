frappe.provide("custom");
frappe.provide("custom.utils");

$.extend(custom.utils, {
	get_previous_row: function(tablename, cdt, cdn){
		let grid = cur_frm.fields_dict[tablename].grid;
		if(grid.grid_rows){
			var d = frappe.get_doc(cdt, cdn);
			return grid.get_grid_row(cint(d.idx -2));
		}
	},	
	get_item_prev_doc: function(doctype) {
		doctype = frappe.model.scrub(doctype);
		var prev_doc = [];
		$.each(cur_frm.doc["items"] || [], function(i, item) {
			if (item[doctype] && !in_list(prev_doc, item[doctype])){
				prev_doc.push(item[doctype]);
			}
		});
		return prev_doc;
	},
	get_child_table_field_value_list: function(table, fieldname){
		var field_value = [];
		$.each(cur_frm.doc[table] || [], function(i, item) {
			if (item[fieldname] && !in_list(field_value, item[fieldname])){
				field_value.push(item[fieldname]);
			}
		});
		return field_value;
	},
	sort_child_table_based_on_field_name: function(table_name, field_name){
		cur_frm.doc[table_name].sort(function (x, y) {
		    return x[field_name]  - y[field_name];
		});
		$.each(cur_frm.doc[table_name] || [], function(i, item) {
			item.idx = i+1;
			refresh_field("idx", item.name, item.parentfield);
		})
	},
	remove_group_button: function(label){
		const btn = cur_frm.page.get_or_add_inner_group_button(label).find("button");
		if(btn){
			btn.addClass("hide");
		}
	},
	update_item_value: function(fieldname, value) {
		$.each(cur_frm.doc["items"] || [], function(i, item) {
			item[fieldname] = value;
			refresh_field(fieldname, item.name, item.parentfield);
		});
	},
	update_value_in_other_item: function(cdn, fieldname, value) {
		$.each(cur_frm.doc["items"] || [], function(i, item) {
			if(item.name != cdn && !item[fieldname]) {
				item[fieldname] = value;
				refresh_field(fieldname, item.name, item.parentfield);
			}
		});
	},
	set_field_background_color: function(field_name, color){
		let ctrl = this.get_field_control_value_element(field_name);
		if (ctrl){
			ctrl.css("background-color", color);
		}
	},
	set_field_foreground_color: function(field_name, color){
		let ctrl = this.get_field_control_value_element(field_name);
		if (ctrl){
			ctrl.css("color", color);
		}
	},
	set_menu_background_color: function(label, color, group){
		let ctrl = this.get_inner_button(label, group);
		if (ctrl){
			ctrl.css("background-color", color);
		}
	},		
	set_menu_foreground_color: function(label, color, group){
		let ctrl = this.get_inner_button(label, group);
		if (ctrl){
			ctrl.css("color", color);
		}
	},
	set_default_button_as_class: function(label, btnclass="btn-primary"){
		let btn = this.get_inner_button(label);
		if(btn){
			btn.removeClass("btn-default").addClass(btnclass);
		}
	},
	get_inner_button: function(label, group){
		if (typeof label === 'string') {
			label = [label];
		}
		// translate
		label = label.map(l => __(l));

		if (group) {
			var $group = cur_frm.page.get_inner_group_button(__(group));
			if($group.length) {
				return $group.find('.dropdown-menu li a[data-label="'+encodeURIComponent(label)+'"]');
			}
		} else {

			return cur_frm.page.inner_toolbar.find('button[data-label="'+encodeURIComponent(label)+'"]');
		}
	},	
	get_field_control_value_element: function(field_name){
		return $('[data-fieldname="'+ field_name + '"]').find(".control-value");
	},
	set_grid_row_background_color: function(table_name, field_name, field_value, operator="===", color="red"){
		let df = cur_frm.get_docfield(table_name, field_name);
		if(!df) return;
		cur_frm.fields_dict[table_name].$wrapper.find('.grid-body .rows').find(".grid-row").each(function(i, row) {
			let d = locals[cur_frm.fields_dict[table_name].grid.doctype][$(row).attr('data-name')];
			let condition = null;
			if(in_list(["Int", "Currency", "Float", "Check", "Percent"], df.fieldtype)) {
				condition = cstr(flt(d[field_name]) + operator  + flt(field_value));
			}else if(in_list(["Date","datetime"], df.fieldtype)) {
				condition = cstr(frappe.datetime.str_to_user(d[field_name]) + operator  + frappe.datetime.str_to_user(field_value));
			}else{
				condition = cstr("'" + d[field_name] +"' " + operator  + " '" + field_value + "'");
			}
			if(condition && eval(condition)){ 
				$(row).find('.grid-static-col').css({'background-color': color});
			}
		});
	},
	disable_add_row: function(tablename){
		if(!cur_frm.get_field(tablename)){
			return;
		}
		cur_frm.set_df_property(tablename, "allow_bulk_edit", 0);
		cur_frm.set_df_property(tablename, "cannot_add_rows", 1);
		cur_frm.set_df_property(tablename, "multiple_set", 0);
	},
	grid_toggle_display: function(tablename, fields, show=false){
		const grid = cur_frm.fields_dict[tablename].grid;
		$.each(fields, function(i, fname) {
			if(frappe.meta.get_docfield(grid.doctype, fname))
				grid.toggle_display(fname, show);
		});			
	},
	copy_value_from_previous_row: function(tablename, cdt, cdn, fields, set_value=true){
		let items = cur_frm.doc[tablename];
		if (items.length > 1){
			let previous_row = this.get_previous_row(tablename, cdt, cdn);
			if(previous_row){
				let current_row = locals[cdt][cdn];
				$.each(fields, function(i, fname) {
					if(previous_row.doc[fname]){
						if(set_value){
							frappe.model.set_value(cdt, cdn, fname, previous_row.doc[fname]);
						}else{
							current_row[fname] = previous_row.doc[fname];	
						}
				
					}
				});						
			}
		}
		return cur_frm.refresh_field(tablename);
	},
	get_value_from_previous_row: function(tablename, cdt, cdn, fieldname){
		let items = cur_frm.doc[tablename];
		if (items.length > 1){
			let previous_row = this.get_previous_row(tablename, cdt, cdn);
			if(previous_row){
				return previous_row.doc[fieldname];
			}
		}		
	},
	sum:function(tablename, fieldname){
		var total = frappe.utils.sum($.map(cur_frm.doc[tablename] || [], function(d) {
			return flt(d[fieldname]);
		}));
		return flt(total);
	},
	download_grid_data: function(frm, tablename, fields=null, title=null){
		const table = frm.get_field(tablename);
		var data = [];
		var docfields = [];
		var fieldnames = [];
		data.push([]);		
		fields = this.get_field_df(table.df.options, fields);
		if(!title){
			title = table.df.label || frappe.model.unscrub(table.df.fieldname);			
		}
		$.each(fields, (i, df) => {
			if (!df.hidden && frappe.model.is_value_type(df.fieldtype)) {
				data[0].push(df.label);
				docfields.push(df);
				fieldnames.push(df.fieldname)
			}
		});	
		$.each(table.frm.doc[table.df.fieldname] || [], (i, d) => {
			var row = [];
			$.each(fieldnames, (i, fieldname) => {
				var value = d[fieldname];
				// format date
				if (docfields[i].fieldtype === "Date" && value) {
					value = frappe.datetime.str_to_user(value);
				}
				row.push(value || "");
			});
			data.push(row);
		});

		frappe.tools.downloadify(data, null, title);
		return false;
	},
	disable_multi_add: function(tablename){
		let btn = $(cur_frm.get_field(tablename).wrapper).find(".grid-add-multiple-rows");
		btn.addClass("hidden");
		return btn;
	},
	
});

$.extend(custom.company, {
	get_info: function(company){
		let company_info = {};
		if(!company && cur_frm){
			company = cur_frm.doc.company;
		}
		if(company){
			company_info = frappe.get_doc(":Company", company);
		}
		return company_info;
	},
	get_country: function(company){
		return this.get_info(company)['country'];
	},
	get_region: function(company){
		return this.get_info(company)['region'];
	},	
	get_stamp: function(company){
		return this.get_info(company)['company_stamp'];
	},	
	get_logo: function(company){
		return this.get_info(company)['company_logo'];
	},			
	get_parent: function(company){
		return this.get_info(company)['parent_company'];
	},				
	is_group: function(company){
		return this.get_info(company)['is_group'];
	},					
});

$.extend(erpnext.utils, {
	toggle_naming_series: function() {
		cur_frm.toggle_display("naming_series", false);
	},
	get_fiscal_year: function(date, company) {
		if(!date) {
			date = frappe.datetime.get_today();
		}
		if (!company){
			company = frappe.defaults.get_user_default("Company");
		}
		let fiscal_year = '';
		frappe.call({
			method: "erpnext.accounts.utils.get_fiscal_year",
			args: {
				date: date,
				company: company
			},
			async: false,
			callback: function(r) {
				if (r.message) {
					fiscal_year = r.message[0];
				}
			}
		});
		return fiscal_year;
	},
	set_fiscal_year_in_query_report: function(query_report, company, date, fieldname) {
		if(!date) {
			date = frappe.datetime.get_today();
		}
		if (!company){
			company = frappe.defaults.get_user_default("Company");
		}
		if(!fieldname){
			fieldname = "fiscal_year";
		}
		query_report.set_filter_value(fieldname, this.get_fiscal_year(date, company));

	}			
});

