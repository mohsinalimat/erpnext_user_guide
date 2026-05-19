
# Jinja Tutorial for Frappe/ERPNext


---

## Group data and calculate sum

You can use below code to group data and calculate sum in Jinja Script:

```
{% 
set items = [
{'item_code':'item1', 'qty': 100, 'amount': 1000},
{'item_code':'item2', 'qty': 200, 'amount': 2000},
{'item_code':'item1', 'qty': 100, 'amount': 1000},
{'item_code':'item3', 'qty': 300, 'amount': 3000},
{'item_code':'item2', 'qty': 200, 'amount': 2000}
]

%}
<table>
<thead>
	<tr>
		<th>Item Code</th>
		<th>Qty</th>
		<th>Total</th>
	</tr>
</thead>
<tbody>
<!-- group items by item_code //-->
{% for item, item_group in items|groupby('item_code') %}
	<tr>
		<td>{{item}}</td>
		<!-- get group total //-->
		<td>{{ item_group|sum(attribute='qty') }}</td>
		<td>{{item_group|sum(attribute='amount')}}</td>
	</tr>

{%- endfor -%}
</tbody>

<tfoot>
	<tr>
		<th>Grand Total</th>
		<!-- get grand total //-->
		<th>{{items|sum(attribute='qty')}}</th>
		<th>{{items|sum(attribute='amount')}}</th>
	</tr>
</tfoot>
</table>


```

### Output

| Item Code   | Qty | Total |
|-------------|-----|-------|
| item1       | 200 | 2000  |
| item2       | 400 | 4000  |
| item3       | 300 | 3000  |
| Grand Total | 900 | 9000  |