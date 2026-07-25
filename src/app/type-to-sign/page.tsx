import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TypeToSignExperience = dynamic(
  () => import("@/features/type-to-sign/TypeToSignExperience"),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto grid max-w-[1100px] gap-6 p-6 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-[600px] w-full rounded-2xl" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    ),
  },
);

export default function TypeToSignPage() {
  return <TypeToSignExperience />;
}
