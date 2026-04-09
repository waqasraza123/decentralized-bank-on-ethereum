import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  History,
  Wallet,
  User,
  CoinsIcon,
  CreditCard,
  Menu
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useUserStore } from "@/stores/userStore";
import { formatShortAddress } from "@/lib/customer-finance";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { isRtl } = useLocale();
  const t = useT();
  const user = useUserStore((state) => state.user);
  const navItems = [
    { icon: Home, label: t("navigation.dashboard"), path: "/" },
    { icon: Wallet, label: t("navigation.wallet"), path: "/wallet" },
    { icon: CoinsIcon, label: t("navigation.staking"), path: "/staking" },
    { icon: CreditCard, label: t("navigation.loans"), path: "/loans" },
    { icon: History, label: t("navigation.transactions"), path: "/transactions" },
    { icon: User, label: t("navigation.profile"), path: "/profile" }
  ];
  const currentSection =
    navItems.find((item) => item.path === location.pathname)?.label ??
    t("layout.workspaceLabel");
  const sidebarWidthClass = isCollapsed ? "w-20" : "w-72";
  const sidebarEdgeClass = isRtl
    ? "right-0 border-l border-r-0"
    : "left-0 border-r";
  const contentInsetClass = isCollapsed
    ? isRtl
      ? "pr-20"
      : "pl-20"
    : isRtl
      ? "pr-72"
      : "pl-72";
  const shortAddress = formatShortAddress(user?.ethereumAddress, t("shared.notAvailable"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-defi-light-purple/5">
      <div className="flex min-h-screen">
        <nav
          className={cn(
            "fixed inset-y-0 z-20 bg-background/70 backdrop-blur-xl transition-all duration-300",
            sidebarWidthClass,
            sidebarEdgeClass
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 p-6">
              {!isCollapsed && <Logo />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={cn(!isCollapsed && (isRtl ? "mr-auto" : "ml-auto"))}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 hover:bg-defi-purple/10",
                      isActive ? "bg-defi-purple text-white" : "text-muted-foreground hover:text-defi-purple",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isActive && "text-white")} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
            <div className="p-4">
              <div className="gradient-border">
                <div className="space-y-2 p-4">
                  {!isCollapsed && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t("layout.walletSummaryTitle")}
                      </p>
                      <p className="ltr-content truncate text-xs font-mono">
                        <bdi>{shortAddress}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("layout.walletSummaryDescription")}
                      </p>
                    </>
                  )}
                  <div
                    className={cn(
                      "h-2 rounded-full bg-gradient-to-r from-defi-purple via-defi-blue to-defi-pink",
                      isCollapsed ? "w-8" : "w-full"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className={cn("flex-1 transition-all duration-300", contentInsetClass)}>
          <div className="container mx-auto px-5 py-6 sm:px-8">
            <header className="mb-8 rounded-[2rem] border border-border/70 bg-background/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-mint-700">
                    {t("layout.workspaceLabel")}
                  </p>
                  <p className="auth-display text-3xl font-semibold tracking-[-0.04em] text-foreground">
                    {currentSection}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-4 lg:items-end">
                  <LanguageSwitcher />
                  <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {t("layout.walletSummaryTitle")}
                    </p>
                    <p className="ltr-content mt-2 text-sm font-semibold text-foreground">
                      <bdi>{shortAddress}</bdi>
                    </p>
                  </div>
                </div>
              </div>
            </header>
            <div className="animate-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};
