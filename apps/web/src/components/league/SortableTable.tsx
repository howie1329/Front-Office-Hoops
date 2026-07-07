import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { Table as TanStackTable } from "@tanstack/react-table"

import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export function SortableTable<TData>({
  table,
  emptyLabel,
  rowClassName,
  stickyHeader = false,
  className,
}: {
  table: TanStackTable<TData>
  emptyLabel: string
  rowClassName?: (row: { original: TData }) => string
  stickyHeader?: boolean
  className?: string
}) {
  return (
    <Table className={className}>
      <TableHeader
        className={stickyHeader ? "sticky top-0 z-10 bg-card" : undefined}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="h-8 px-2">
                {header.isPlaceholder ? null : (
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 text-left font-medium",
                      header.column.getCanSort() && "hover:text-foreground",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() ? (
                      <span className="text-[0.625rem] text-muted-foreground">
                        {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={rowClassName?.(row)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-2 py-1.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={table.getAllColumns().length}
              className="text-muted-foreground"
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export { flexRender, getCoreRowModel, getSortedRowModel, useReactTable }
export type { SortingState, ColumnDef } from "@tanstack/react-table"
