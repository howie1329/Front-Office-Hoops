import type { StaffMember } from "@workspace/shared/types"

import { formatStaffRole } from "@/components/league/staff/staffLabels"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

type FireStaffDialogProps = {
  member: StaffMember | null
  onClose: () => void
  onConfirm: (staffId: string) => void
}

export function FireStaffDialog({
  member,
  onClose,
  onConfirm,
}: FireStaffDialogProps) {
  return (
    <AlertDialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      {member ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Release {member.firstName} {member.lastName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Release {member.firstName} {member.lastName} (
              {formatStaffRole(member.role)})? Their contract terminates and they
              enter the pro coaching market.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onConfirm(member.id)}>
              Release coach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  )
}
