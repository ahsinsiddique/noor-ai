import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureConfig } from "@/contexts/FeatureConfigContext";

export default function IndexRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const { config } = useFeatureConfig();

  if (isLoading) return null;

  if (isAuthenticated) {
    if (config.simpleMode) return <Redirect href={"/simple" as never} />;
    return <Redirect href="/mode-select" />;
  }

  return <Redirect href="/(auth)/login" />;
}
