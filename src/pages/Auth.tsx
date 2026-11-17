import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatAuthPassword } from "@/utils/authPassword";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error("Vui lòng nhập tên đăng nhập và mật khẩu");
      return;
    }

    if (username.length < 3) {
      toast.error("Tên đăng nhập phải có ít nhất 3 ký tự");
      return;
    }

    if (!password) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }

    setLoading(true);

    try {
      // Normalize username and convert to email format for Supabase Auth
      const cleanUsername = username.trim().toLowerCase();
      const email = cleanUsername.includes("@") ? cleanUsername : `${cleanUsername}@karaoke.local`;
      const authPassword = formatAuthPassword(password);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Tên đăng nhập hoặc mật khẩu không đúng");
        } else if (error.message.toLowerCase().includes("failed to fetch")) {
          toast.error("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Tài khoản chưa được kích hoạt");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Đăng nhập thành công!");
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase()?.includes("failed to fetch")) {
        toast.error("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
      } else {
        toast.error("Có lỗi xảy ra: " + (error?.message || "Không xác định"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg font-semibold text-center tracking-tight">
            Hệ thống quản lý
          </CardTitle>
          <CardDescription className="text-center text-xs">
            Đăng nhập vào hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                minLength={3}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
