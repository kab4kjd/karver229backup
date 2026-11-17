import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatAuthPassword } from "@/utils/authPassword";

interface Props {
  username: string;
  displayName?: string;
  email: string;
  onUnlock: () => void;
}

const LockScreen = ({ username, displayName, email, onUnlock }: Props) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    const authPassword = formatAuthPassword(password);
    const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    setLoading(false);
    if (error) {
      toast({ title: "Mật khẩu không đúng", variant: "destructive" });
      setPassword("");
      return;
    }
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Màn hình đã khoá</h2>
          <p className="text-sm text-muted-foreground">
            Nhập mật khẩu của <strong>{displayName || username}</strong> để mở khoá
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lock-pw">Mật khẩu</Label>
          <Input
            id="lock-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={loading}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Mở khoá
        </Button>
      </form>
    </div>
  );
};

export default LockScreen;
