import dynamic from "next/dynamic";

const TypeToSignExperience = dynamic(
  () => import("@/features/type-to-sign/TypeToSignExperience"),
  { ssr: false },
);

export default function TypeToSignPage() {
  return <TypeToSignExperience />;
}
