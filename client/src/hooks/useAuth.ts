import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch custom permissions if user has custom role
  const { data: customPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/auth/user/permissions"],
    enabled: !!user && user.role === "custom",
    staleTime: 5 * 60 * 1000,
  });

  // Merge custom permissions into user object
  const userWithPermissions = user && user.role === "custom" 
    ? { ...user, customPermissions: customPermissions || {} }
    : user;

  const isAuthenticated = !!user;
  const isPermissionsLoading = user?.role === "custom" ? permissionsLoading : false;

  return {
    user: userWithPermissions,
    isAuthenticated,
    isLoading: isLoading || isPermissionsLoading,
  };
}