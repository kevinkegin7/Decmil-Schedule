import { FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/card";

export function VerificationBadge({ status }: { status: string }) {
  if (status === "document_verified") {
    return <Badge variant="success"><FileCheck2 /> Verified with document</Badge>;
  }
  if (status === "user_verified") {
    return <Badge variant="success"><ShieldCheck /> Verified by you</Badge>;
  }
  return <Badge variant="outline"><ShieldAlert /> Unverified</Badge>;
}
