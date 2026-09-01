interface SpeakItOverlayProps {
  title: string;
  hint: string;
  onDone: (transcript: string) => void;
  onCancel: () => void;
}

export default function SpeakItOverlay(_props: SpeakItOverlayProps) {
  return null;
}
