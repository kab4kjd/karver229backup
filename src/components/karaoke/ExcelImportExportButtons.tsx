import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  onExport: () => void | Promise<void>;
  onImport: (file: File) => Promise<string>;
  exportLabel?: string;
  importLabel?: string;
}

const ExcelImportExportButtons = ({
  onExport,
  onImport,
  exportLabel = "Xuất Excel",
  importLabel = "Nhập Excel",
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const message = await onImport(file);
      toast({ title: "Thành công", description: message });
    } catch (err: any) {
      toast({
        title: "Lỗi nhập file",
        description: err?.message || "Không đọc được file",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
        <Download className="h-4 w-4" />
        {exportLabel}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {importLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

export default ExcelImportExportButtons;
