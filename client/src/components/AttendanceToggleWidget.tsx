import AttendanceWidget from './AttendanceWidget';

export default function AttendanceToggleWidget({
  compact = false,
  onStatusChange,
}: {
  compact?: boolean;
  onStatusChange?: () => void;
}) {
  return <AttendanceWidget compact={compact} onStatusChange={onStatusChange} />;
}
