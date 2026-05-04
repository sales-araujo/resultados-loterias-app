import { Card, CardContent } from "@/components/ui/card";

export function GameCardSkeleton() {
  return (
    <div className="w-full min-w-0 shrink-0">
      <Card className="overflow-hidden animate-pulse">
        {/* Color bar */}
        <div className="h-1.5 bg-muted" />
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Badge and action buttons row */}
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-36 rounded-full bg-muted" />
            <div className="flex gap-1 shrink-0">
              <div className="h-7 w-7 rounded-md bg-muted" />
              <div className="h-7 w-7 rounded-md bg-muted" />
            </div>
          </div>

          {/* Number grid */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-md bg-muted"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
