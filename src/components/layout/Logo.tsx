import Image from "next/image";

export function Logo({ width = 160, height = 43 }: { width?: number; height?: number }) {
  return (
    <>
      <Image src="/logo-light.png" alt="Clique Boost Dash" width={width} height={height} priority className="block dark:hidden" />
      <Image src="/logo-dark.png" alt="Clique Boost Dash" width={width} height={height} priority className="hidden dark:block" />
    </>
  );
}
