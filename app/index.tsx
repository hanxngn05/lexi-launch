import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/context/auth";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      if (user) {
        const consentGiven = Boolean((user as any)?.consent_given);
        router.replace(consentGiven ? '/workspace/lexi' : '/consent');
      }
    };
    redirectIfLoggedIn();
  }, [user, router]);

  // Always show LoginForm when no user, even if loading (prevents remount/reset of local state)
  if (!user) {
    return <LoginForm />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
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
