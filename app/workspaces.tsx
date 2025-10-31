import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WorkspacesScreen() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  useEffect(() => {
    setWorkspaces([]);
    setLoading(false);
  }, []);

  // In Lexi-only mode, do not redirect
  useEffect(() => {
    const noop = async () => {};
    noop();
  }, [router]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <Text style={styles.title}>Available Workspaces</Text>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {workspaces.length === 0 ? (
          <Text style={styles.emptyText}>No workspaces available yet.</Text>
        ) : (
          workspaces.map((ws) => (
            <View key={ws.id} style={styles.workspaceCard}>
              <Text style={styles.workspaceName}>{ws.name}</Text>
              <Text style={styles.workspaceDescription}>{ws.description}</Text>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: ws.id } })}
              >
                <Text style={styles.joinButtonText}>Join Workspace</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF',
    paddingTop: 60,
    paddingHorizontal: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#D9E7FF',
    top: -50,
    left: -50,
    opacity: 0.5,
  },
  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#D9E7FF',
    bottom: -100,
    right: -100,
    opacity: 0.5,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  workspaceCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 25,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 2,
  },
  workspaceName: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  workspaceDescription: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    marginTop: 40,
  },
});
