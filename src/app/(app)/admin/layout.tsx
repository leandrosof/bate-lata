import { Settings } from "lucide-react";
import { AdminTabs } from "@/components/layout/admin-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Administração" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        eyebrow="Acesso restrito"
        title="Administração"
        subtitle="Gerencie eventos, pessoas, resultados e as regras do grupo."
        icon={<Settings className="h-5 w-5" />}
      />
      <AdminTabs />
      {children}
    </div>
  );
}
