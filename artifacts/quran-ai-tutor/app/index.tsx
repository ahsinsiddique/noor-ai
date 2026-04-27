import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";

export default function IndexRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated) {
    return <Redirect href="/mode-select" />;
  }

  return <Redirect href="/(auth)/login" />;
}
