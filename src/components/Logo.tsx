import Image from "next/image";

export function Logo() {
  return (
    <>
      <Image src="/logo-light.png" alt="Clique Boost Dash" width={160} height={43} priority className="block dark:hidden" />
      <Image src="/logo-dark.png" alt="Clique Boost Dash" width={160} height={43} priority className="hidden dark:block" />
    </>
  );
}
