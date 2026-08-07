import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-start">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
