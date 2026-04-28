import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ButtonProps } from "@/components/ui/button";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingLabel?: string;
  isLoading?: boolean;
}

export function LoadingButton({
  children,
  loading,
  loadingLabel,
  isLoading,
  disabled,
  ...props
}: LoadingButtonProps) {
  const pending = loading ?? isLoading ?? false;

  return (
    <Button aria-busy={pending} disabled={disabled || pending} {...props}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending && loadingLabel ? loadingLabel : children}
    </Button>
  );
}
