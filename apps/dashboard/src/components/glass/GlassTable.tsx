interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  className?: string
}

interface GlassTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  emptyMessage?: string
}

export function GlassTable<T>({ columns, data, onRowClick, emptyMessage = 'No data' }: GlassTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-xorb-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/8">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-medium text-xorb-muted uppercase tracking-wider ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-white/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''} transition-colors`}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
