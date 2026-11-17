import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, Trash2, UserPlus, Loader2, Settings2, Key, Pencil, Check } from "lucide-react";
import { useUserManagement, type UserRole, type UserPermissions } from "@/hooks/useUserManagement";
import { toast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UserManagementProps {
  currentUserId: string;
}

const defaultPermissions: UserPermissions = {
  can_view_invoice: true,
  can_view_history: true,
  can_delete_history: false,
  can_view_reports: false,
  can_view_inventory: false,
  can_edit_inventory_history: false,
  can_delete_inventory_history: false,
  can_view_config: false,
  can_view_logs: false,
  can_delete_logs: false,
  can_view_expenses: false,
  can_view_customers: false,
  can_delete_customers: false,
  edit_invoice_minutes: 60,
  can_config_rooms: true,
  can_config_items: true,
  can_config_pricelist: false,
  can_config_layout: false,
  can_config_print: false,
  lock_screen_enabled: false,
  lock_screen_minutes: 5,
};

export default function UserManagement({ currentUserId }: UserManagementProps) {
  const { users, isLoading, createUser, updateUserRole, updateUserPermissions, deleteUser, updatePassword, updateDisplayName } = useUserManagement();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("staff");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions>(defaultPermissions);
  const [passwordChangeUserId, setPasswordChangeUserId] = useState<string | null>(null);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [editingDisplayNameId, setEditingDisplayNameId] = useState<string | null>(null);
  const [editingDisplayNameValue, setEditingDisplayNameValue] = useState("");

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 3) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu phải có ít nhất 3 ký tự",
        variant: "destructive",
      });
      return;
    }

    await createUser.mutateAsync({
      username: newUsername,
      password: newPassword,
      role: newRole,
    });

    setNewUsername("");
    setNewPassword("");
    setNewRole("staff");
    setShowAddForm(false);
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole.mutateAsync({ userId, role });
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      toast({
        title: "Lỗi",
        description: "Bạn không thể xóa tài khoản của chính mình",
        variant: "destructive",
      });
      return;
    }
    await deleteUser.mutateAsync(userId);
  };

  const handleOpenPermissions = (userId: string, permissions: UserPermissions | null) => {
    setEditingUserId(userId);
    setEditingPermissions({ ...defaultPermissions, ...(permissions || {}) });
  };

  const handleSavePermissions = async () => {
    if (!editingUserId) return;
    await updateUserPermissions.mutateAsync({
      userId: editingUserId,
      permissions: editingPermissions,
    });
    setEditingUserId(null);
  };

  const handlePermissionChange = (key: keyof UserPermissions, value: boolean) => {
    setEditingPermissions(prev => ({ ...prev, [key]: value }));
  };

  const handleChangePassword = async () => {
    if (!passwordChangeUserId || !newUserPassword.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mật khẩu mới",
        variant: "destructive",
      });
      return;
    }

    if (newUserPassword.length < 3) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu phải có ít nhất 3 ký tự",
        variant: "destructive",
      });
      return;
    }

    await updatePassword.mutateAsync({
      userId: passwordChangeUserId,
      password: newUserPassword,
    });

    setPasswordChangeUserId(null);
    setNewUserPassword("");
  };

  const getRoleBadgeColor = (role: UserRole | null) => {
    if (role === "admin") return "bg-destructive text-destructive-foreground";
    if (role === "staff") return "bg-primary text-primary-foreground";
    return "bg-muted text-muted-foreground";
  };

  const getRoleLabel = (role: UserRole | null) => {
    if (role === "admin") return "Quản trị viên";
    if (role === "staff") return "Nhân viên";
    return "Chưa phân quyền";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const editingUser = users.find(u => u.id === editingUserId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Quản lý người dùng
            </CardTitle>
            <CardDescription>Thêm, xóa và phân quyền cho nhân viên</CardDescription>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {showAddForm ? "Hủy" : "Thêm người dùng"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-username">Tên đăng nhập</Label>
                  <Input
                    id="new-username"
                    type="text"
                    placeholder="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Mật khẩu</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Tối thiểu 3 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Vai trò</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Nhân viên</SelectItem>
                    <SelectItem value="admin">Quản trị viên</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={createUser.isPending}
                className="w-full"
              >
                {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tạo tài khoản
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Tên nhân viên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Chưa có người dùng nào
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      {editingDisplayNameId === user.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingDisplayNameValue}
                            onChange={(e) => setEditingDisplayNameValue(e.target.value)}
                            className="h-8 w-32"
                            placeholder="Tên nhân viên"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateDisplayName.mutate({ userId: user.id, displayName: editingDisplayNameValue });
                                setEditingDisplayNameId(null);
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateDisplayName.mutate({ userId: user.id, displayName: editingDisplayNameValue });
                              setEditingDisplayNameId(null);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1 cursor-pointer hover:text-primary"
                          onClick={() => {
                            setEditingDisplayNameId(user.id);
                            setEditingDisplayNameValue(user.display_name || "");
                          }}
                        >
                          <span className={user.display_name ? "" : "text-muted-foreground italic"}>
                            {user.display_name || "Chưa đặt"}
                          </span>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role || ""}
                        onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                        disabled={user.id === currentUserId || updateUserRole.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Nhân viên</SelectItem>
                          <SelectItem value="admin">Quản trị viên</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Dialog open={editingUserId === user.id} onOpenChange={(open) => {
                        if (!open) setEditingUserId(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPermissions(user.id, user.permissions)}
                            disabled={user.role === "admin"}
                            title={user.role === "admin" ? "Admin có đầy đủ quyền" : "Cấu hình quyền truy cập"}
                          >
                            <Settings2 className="h-4 w-4 text-primary" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Phân quyền cho {editingUser?.username}</DialogTitle>
                            <DialogDescription>
                              Chọn các tab mà nhân viên này có thể truy cập (tab bị tắt sẽ tự động ẩn)
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Hóa đơn</Label>
                                <p className="text-sm text-muted-foreground">Tạo, tính tiền và in hóa đơn phòng</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_invoice}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_invoice", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Lịch sử</Label>
                                <p className="text-sm text-muted-foreground">Xem lịch sử hóa đơn</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_history}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_history", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Xóa lịch sử</Label>
                                <p className="text-sm text-muted-foreground">Cho phép xóa hóa đơn trong lịch sử</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_delete_history}
                                onCheckedChange={(checked) => handlePermissionChange("can_delete_history", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Báo cáo</Label>
                                <p className="text-sm text-muted-foreground">Xem báo cáo doanh thu</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_reports}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_reports", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Kiểm kho</Label>
                                <p className="text-sm text-muted-foreground">Quản lý kiểm kho</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_inventory}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_inventory", checked)}
                              />
                            </div>
                            {editingPermissions.can_view_inventory && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-3">
                                <p className="text-xs text-muted-foreground">Quyền hạn trong Kiểm kho:</p>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-sm font-normal">Sửa lịch sử kiểm kho</Label>
                                    <p className="text-xs text-muted-foreground">Cho phép sửa & lưu đè lịch sử kiểm kho đã có</p>
                                  </div>
                                  <Switch
                                    checked={editingPermissions.can_edit_inventory_history}
                                    onCheckedChange={(checked) => handlePermissionChange("can_edit_inventory_history", checked)}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-sm font-normal">Xóa lịch sử kiểm kho</Label>
                                    <p className="text-xs text-muted-foreground">Cho phép xóa các bản ghi lịch sử kiểm kho</p>
                                  </div>
                                  <Switch
                                    checked={editingPermissions.can_delete_inventory_history}
                                    onCheckedChange={(checked) => handlePermissionChange("can_delete_inventory_history", checked)}
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Cấu hình</Label>
                                <p className="text-sm text-muted-foreground">Quản lý cấu hình hệ thống</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_config}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_config", checked)}
                              />
                            </div>
                            {editingPermissions.can_view_config && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-3">
                                <p className="text-xs text-muted-foreground">Tab con trong Cấu hình:</p>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-normal">Phòng</Label>
                                  <Switch
                                    checked={editingPermissions.can_config_rooms}
                                    onCheckedChange={(checked) => handlePermissionChange("can_config_rooms", checked)}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-normal">Món ăn</Label>
                                  <Switch
                                    checked={editingPermissions.can_config_items}
                                    onCheckedChange={(checked) => handlePermissionChange("can_config_items", checked)}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-normal">Bảng giá</Label>
                                  <Switch
                                    checked={editingPermissions.can_config_pricelist}
                                    onCheckedChange={(checked) => handlePermissionChange("can_config_pricelist", checked)}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-normal">Bố cục</Label>
                                  <Switch
                                    checked={editingPermissions.can_config_layout}
                                    onCheckedChange={(checked) => handlePermissionChange("can_config_layout", checked)}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-normal">Mẫu in</Label>
                                  <Switch
                                    checked={editingPermissions.can_config_print}
                                    onCheckedChange={(checked) => handlePermissionChange("can_config_print", checked)}
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Chi phí</Label>
                                <p className="text-sm text-muted-foreground">Xem và quản lý chi phí</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_expenses}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_expenses", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Khách hàng</Label>
                                <p className="text-sm text-muted-foreground">Xem &amp; cập nhật hoá đơn nợ / trả một phần</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_customers}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_customers", checked)}
                              />
                            </div>
                            {editingPermissions.can_view_customers && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-3">
                                <p className="text-xs text-muted-foreground">Quyền hạn trong Khách hàng:</p>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-sm font-normal">Xóa khách hàng</Label>
                                    <p className="text-xs text-muted-foreground">Cho phép xóa khách hàng khỏi danh bạ</p>
                                  </div>
                                  <Switch
                                    checked={editingPermissions.can_delete_customers}
                                    onCheckedChange={(checked) => handlePermissionChange("can_delete_customers", checked)}
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Tab Log</Label>
                                <p className="text-sm text-muted-foreground">Xem nhật ký hoạt động</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_view_logs}
                                onCheckedChange={(checked) => handlePermissionChange("can_view_logs", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>Xóa Log</Label>
                                <p className="text-sm text-muted-foreground">Cho phép xóa nhật ký hoạt động</p>
                              </div>
                              <Switch
                                checked={editingPermissions.can_delete_logs}
                                onCheckedChange={(checked) => handlePermissionChange("can_delete_logs", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-3 border-t">
                              <div className="flex-1">
                                <Label>Thời gian được chỉnh sửa hóa đơn</Label>
                                <p className="text-sm text-muted-foreground">Số phút sau khi tạo hóa đơn mà nhân viên vẫn có thể sửa. Đặt <strong>0</strong> để không giới hạn.</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-24"
                                  value={editingPermissions.edit_invoice_minutes}
                                  onChange={(e) =>
                                    setEditingPermissions((p) => ({
                                      ...p,
                                      edit_invoice_minutes: Math.max(0, Number(e.target.value) || 0),
                                    }))
                                  }
                                />
                                <span className="text-sm text-muted-foreground">phút</span>
                              </div>
                            </div>

                            <div className="pt-3 border-t space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>Khoá màn hình khi không thao tác</Label>
                                  <p className="text-sm text-muted-foreground">Tự động khoá màn hình; mở lại phải nhập mật khẩu của chính user này.</p>
                                </div>
                                <Switch
                                  checked={editingPermissions.lock_screen_enabled}
                                  onCheckedChange={(checked) => handlePermissionChange("lock_screen_enabled" as any, checked)}
                                />
                              </div>
                              {editingPermissions.lock_screen_enabled && (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <Label>Thời gian chờ trước khi khoá</Label>
                                    <p className="text-sm text-muted-foreground">Số phút không thao tác trước khi tự động khoá.</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min={1}
                                      className="w-24"
                                      value={editingPermissions.lock_screen_minutes}
                                      onChange={(e) =>
                                        setEditingPermissions((p) => ({
                                          ...p,
                                          lock_screen_minutes: Math.max(1, Number(e.target.value) || 1),
                                        }))
                                      }
                                    />
                                    <span className="text-sm text-muted-foreground">phút</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingUserId(null)}>
                              Hủy
                            </Button>
                            <Button onClick={handleSavePermissions} disabled={updateUserPermissions.isPending}>
                              {updateUserPermissions.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Lưu
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={passwordChangeUserId === user.id} onOpenChange={(open) => {
                        if (!open) {
                          setPasswordChangeUserId(null);
                          setNewUserPassword("");
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPasswordChangeUserId(user.id)}
                            title="Đổi mật khẩu"
                          >
                            <Key className="h-4 w-4 text-orange-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Đổi mật khẩu cho {user.username}</DialogTitle>
                            <DialogDescription>
                              Nhập mật khẩu mới cho người dùng này
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-user-password">Mật khẩu mới</Label>
                              <Input
                                id="new-user-password"
                                type="password"
                                placeholder="Tối thiểu 3 ký tự"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                maxLength={100}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => {
                              setPasswordChangeUserId(null);
                              setNewUserPassword("");
                            }}>
                              Hủy
                            </Button>
                            <Button onClick={handleChangePassword} disabled={updatePassword.isPending}>
                              {updatePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Cập nhật
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={user.id === currentUserId || deleteUser.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xác nhận xóa người dùng</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc chắn muốn xóa người dùng <strong>{user.username}</strong>?
                              Hành động này không thể hoàn tác.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
