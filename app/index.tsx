import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/context/auth";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();

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
