import { Navigate, useLocation } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const user = useUserStore((state) => state.user);
    const location = useLocation();

    if (!user) {
        return (
            <Navigate
                to="/auth/sign-in"
                replace
                state={{
                    from: `${location.pathname}${location.search}${location.hash}`,
                }}
            />
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
