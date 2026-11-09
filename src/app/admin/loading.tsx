export default function AdminLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-[#121216] p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-white/[0.06] rounded-md" />
              <div className="h-5 w-5 bg-red-500/10 rounded-md" />
            </div>
            <div className="h-8 w-16 bg-white/[0.1] rounded-lg mt-2" />
            <div className="h-2.5 w-32 bg-white/[0.04] rounded-md" />
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#121216] p-6 space-y-4">
        <div className="h-6 w-48 bg-white/[0.08] rounded-md" />
        <div className="space-y-3 pt-2">
          <div className="h-12 w-full bg-white/[0.04] rounded-xl" />
          <div className="h-12 w-full bg-white/[0.04] rounded-xl" />
          <div className="h-12 w-full bg-white/[0.04] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
