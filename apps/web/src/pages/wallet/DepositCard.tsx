import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useGetUser } from "@/hooks/user/useGetUser";
import { QRCodeSVG } from "qrcode.react";

const DepositCard = () => {
  const [depositAddress, setDepositAddress] = useState("");
  const [showQR, setShowQR] = useState(false);

  const userId = JSON.parse(localStorage.getItem("user") || "{}").supabaseUserId || "";
  const { loading: loadingUser, user } = useGetUser(userId);

  useEffect(() => {
    if (user?.ethereumAddress) {
      setDepositAddress(user.ethereumAddress);
    }
  }, [user]);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5 text-mint-600" />
          Quick Deposit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="mb-2 text-sm text-muted-foreground">Your Deposit Address</div>
            <div className="flex items-center justify-between gap-4">
              <code className="rounded bg-mint-50 px-2 py-1 text-sm">
                {loadingUser ? <Loader2 className="animate-spin" /> : depositAddress}
              </code>
              <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
                {showQR ? "Hide QR" : "Show QR"}
              </Button>
            </div>

            {showQR && depositAddress && (
              <div className="mt-4 flex justify-center">
                <QRCodeSVG
                  value={depositAddress}
                  size={160}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepositCard;
