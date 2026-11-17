import { AlertTriangle } from "lucide-react";
import { useSingleTab } from "@/hooks/useSingleTab";

const SingleTabGate = () => {
  const { locked } = useSingleTab();
  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 shadow-xl text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Đã mở ở một cửa sổ khác</h2>
        <p className="text-sm text-muted-foreground">
          Vui lòng đóng cửa sổ này &amp; đảm bảo chỉ mở duy nhất một màn hình.
        </p>
      </div>
    </div>
  );
};

export default SingleTabGate;
