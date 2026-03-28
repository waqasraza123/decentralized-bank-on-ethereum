import { Navigate } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const user = useUserStore((state) => state.user);

    if (!user) {
        console.log("not user");
        return <Navigate to="/auth/sign-in" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
