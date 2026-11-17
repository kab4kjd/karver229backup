import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Search, RefreshCw, Activity, AlertTriangle } from "lucide-react";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActivityLogsTabProps {
  canDelete?: boolean;
}

const getActionColor = (action: string) => {
  switch (action) {
    case "LOGIN":
      return "bg-blue-500";
    case "LOGOUT":
      return "bg-gray-500";
    case "CREATE":
      return "bg-green-500";
    case "UPDATE":
      return "bg-yellow-500";
    case "DELETE":
      return "bg-red-500";
    case "CHECKOUT":
      return "bg-purple-500";
    case "PRINT":
      return "bg-cyan-500";
    default:
      return "bg-primary";
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case "LOGIN":
      return "Đăng nhập";
    case "LOGOUT":
      return "Đăng xuất";
    case "CREATE":
      return "Tạo mới";
    case "UPDATE":
      return "Cập nhật";
    case "DELETE":
      return "Xóa";
    case "CHECKOUT":
      return "Thanh toán";
    case "PRINT":
      return "In";
    default:
      return action;
  }
};

export const ActivityLogsTab = ({ canDelete = false }: ActivityLogsTabProps) => {
  const { logs, isLoading, refetch, deleteAllLogs, isDeleting } = useActivityLogs();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = logs.filter(
    (log) =>
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Log Hoạt Động
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Làm mới
          </Button>
          {canDelete && logs.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Xóa tất cả
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc chắn muốn xóa tất cả log hoạt động? Hành động này không thể hoàn tác.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteAllLogs()}>
                    Xóa tất cả
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo người dùng, hành động, mô tả..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Đang tải...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Không tìm thấy kết quả" : "Chưa có log hoạt động nào"}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Thời gian</TableHead>
                  <TableHead className="w-[120px]">Người dùng</TableHead>
                  <TableHead className="w-[100px]">Hành động</TableHead>
                  <TableHead>Mô tả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                        locale: vi,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{log.username}</TableCell>
                    <TableCell>
                      <Badge className={`${getActionColor(log.action)} text-white`}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[500px]">
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1">
                          {log.metadata && (log.metadata as Record<string, unknown>).changes && 
                           Array.isArray((log.metadata as Record<string, unknown>).changes) &&
                           ((log.metadata as Record<string, unknown>).changes as string[]).length > 0 ? (
                            <div>
                              <p className="text-sm mb-1">{log.description.split(":")[0]}</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {((log.metadata as Record<string, unknown>).changes as string[]).map((change, idx) => (
                                  <li key={idx} className="text-xs text-muted-foreground">{change}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <span className="text-sm">{log.description}</span>
                          )}
                        </div>
                        {log.action === "UPDATE" && log.metadata && (log.metadata as Record<string, unknown>).totalReduced === true && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="w-[30px] h-[30px] text-red-500 shrink-0 mt-0.5" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tổng tiền hóa đơn đã bị giảm sau chỉnh sửa</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          Hiển thị {filteredLogs.length} / {logs.length} log
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLogsTab;
