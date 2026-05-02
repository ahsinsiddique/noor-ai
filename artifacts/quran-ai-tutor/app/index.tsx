import { Redirect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureConfig } from "@/contexts/FeatureConfigContext";

export default function IndexRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const { config } = useFeatureConfig();

  if (isLoading) return null;

  // Guests always land on simple mode — no auth required
  if (!isAuthenticated) return <Redirect href={"/simple" as never} />;

  // Authenticated users: respect their mode preference
  // Default (simpleMode: false) → advanced mode
  if (config.simpleMode) return <Redirect href={"/simple" as never} />;
  return <Redirect href="/mode-select" />;
}