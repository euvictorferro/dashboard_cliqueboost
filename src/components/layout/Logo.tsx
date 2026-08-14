import Image from "next/image";

export function Logo({
  width = 160,
  height = 43,
  alt = "Clique Boost Dash",
}: {
  width?: number;
  height?: number;
  alt?: string;
}) {
  return (
    <>
      <Image src="/logo-light.png" alt={alt} width={width} height={height} priority className="block dark:hidden" />
      <Image src="/logo-dark.png" alt={alt} width={width} height={height} priority className="hidden dark:block" />
    </>
  );
}
