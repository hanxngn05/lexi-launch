import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/context/auth";
import { api } from "@/utils/api";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      if (user) {
        try {
          const workspacesData: any = await api.getWorkspaces();
          const lexiWorkspace = (workspacesData?.workspaces || []).find((ws: any) =>
            typeof ws?.name === 'string' && ws.name.toLowerCase().includes('lexi')
          );
          if (lexiWorkspace?.id) {
            router.replace(`/workspace/${lexiWorkspace.id}`);
          }
        } catch (e) {
          // ignore
        }
      }
    };
    redirectIfLoggedIn();
  }, [user, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <View style={styles.loadingContainer}>
      {/* User is logged in, render nothing or redirect logic can go here */}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F8FF",
  },
});
