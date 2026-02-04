export function exportToCSV(rows: Record<string, string>[], filename: string) {
  if (rows.length === 0) return

  var headers = Object.keys(rows[0])
  var csvRows = [headers.join(",")]

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var vals: string[] = []
    for (var h = 0; h < headers.length; h++) {
      var val = row[headers[h]] || ""
      vals.push('"' + val.replace(/"/g, '""') + '"')
    }
    csvRows.push(vals.join(","))
  }

  var blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  var url = URL.createObjectURL(blob)
  var link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
