"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteEmployerAction } from "@/app/dashboard/intel-actions";
import { ConfirmDialog } from "@/components/ui/dialog";

export function DeleteEmployerButton({ id, name, trigger }: { id: string; name: string; trigger: React.ReactNode }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      description="The employer, its jobs, evidence, saved items and rankings are permanently removed. The deletion is audited."
      confirmLabel="Delete"
      destructive
      pending={pending}
      onConfirm={() =>
        start(async () => {
          const r = await deleteEmployerAction(id);
          if (r.ok) {
            toast.success(r.message);
            router.push("/dashboard/employers");
          } else toast.error(r.message);
        })
      }
      trigger={trigger}
    />
  );
}
