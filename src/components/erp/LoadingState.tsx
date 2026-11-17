import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TableLoadingRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((__, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton
                className={
                  colIdx === 0
                    ? "h-4 w-16"
                    : colIdx === columns - 1
                      ? "ml-auto h-4 w-14"
                      : "h-4 w-full max-w-[160px]"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${count === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-3.5 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
