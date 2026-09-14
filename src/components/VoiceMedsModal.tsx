export interface MedicationForForm {
  name: string;
  dosage: string;
  frequency: string;
  times: string;
  with_food: string;
  prescribed_by: string;
}

interface VoiceMedsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMedication: (med: MedicationForForm) => void;
}

export default function VoiceMedsModal(_props: VoiceMedsModalProps) {
  return null;
}
