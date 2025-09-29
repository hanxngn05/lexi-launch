import { useAuth } from '@/context/auth';
import { api } from '@/utils/api';
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

type Question = {
  text: string;
  type: 'text' | 'image' | 'audio';
};

type Workspace = {
  name: string;
  description: string;
  questions: Question[];
  developer: string;
};

export default function DeveloperHome() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  // In Lexi-only mode, redirect if this screen is visited
  useEffect(() => {
    const go = async () => {
      try {
        const data = await api.getWorkspaces();
        const lexiWorkspace = (data?.workspaces || []).find((ws: any) =>
          typeof ws?.name === 'string' && ws.name.toLowerCase().includes('lexi')
        );
        if (lexiWorkspace?.id) {
          router.replace(`/workspace/${lexiWorkspace.id}`);
        }
      } catch (e) {
        // ignore
      }
    };
    go();
  }, [router]);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  const fetchWorkspaces = async () => {
    if (user?.id) {
      try {
        const fetchedWorkspaces = await api.getWorkspaces();
        if (fetchedWorkspaces && fetchedWorkspaces.workspaces) {
          const developerWorkspaces = fetchedWorkspaces.workspaces.filter(
            (w: Workspace) => w.developer === user.id
          );
          setWorkspaces(developerWorkspaces);
        } else {
          setWorkspaces([]);
        }
      } catch (error) {
        console.error('Failed to fetch workspaces:', error);
        setWorkspaces([]);
      } finally {
        // Reduce loading time for better UX
        setTimeout(() => setLoading(false), 300);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const handleSignOut = () => {
    signOut();
    router.replace('/');
  };

  const handleProfileMenuPress = () => {
    setShowProfileMenu(true);
  };

  const handleMenuOption = (option: string) => {
    setShowProfileMenu(false);
    if (option === 'signOut') {
      handleSignOut();
    }
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Elements */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          {/* User Profile Circle */}
          <TouchableOpacity style={styles.profileCircle} onPress={handleProfileMenuPress}>
            <Text style={styles.profileInitial}>
              {(user?.name || 'D').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Menu Modal */}
        <Modal
          visible={showProfileMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowProfileMenu(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowProfileMenu(false)}
          >
            <View style={styles.profileMenu}>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleMenuOption('signOut')}
              >
                <Ionicons name="log-out-outline" size={20} color="#F44336" />
                <Text style={[styles.menuOptionText, styles.signOutText]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
            <Text style={styles.sectionTitle}>Create New Workspace</Text>
          </View>
          <Link href="/create-workspace" asChild>
            <TouchableOpacity style={styles.createButton}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create New Workspace</Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={24} color="#4A90E2" />
            <Text style={styles.sectionTitle}>Your Workspaces</Text>
          </View>
          {workspaces.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="folder-open-outline" size={48} color="#4A90E2" />
              </View>
              <Text style={styles.emptyText}>No workspaces yet</Text>
              <Text style={styles.emptySubText}>Create your first workspace to get started!</Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {workspaces.map((workspace, index) => (
                <Animated.View
                  key={workspace.name}
                  style={[
                    styles.workspaceCard,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.workspaceIcon}>
                      <Ionicons name="business-outline" size={20} color="#4A90E2" />
                    </View>
                    <View style={styles.workspaceInfo}>
                      <Text style={styles.workspaceName}>{workspace.name}</Text>
                      <Text style={styles.workspaceDescription}>{workspace.description}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.manageButton}
                    onPress={() => router.push(`/workspace/${workspace.name}`)}
                  >
                    <Ionicons name="settings-outline" size={16} color="#4A90E2" />
                    <Text style={styles.manageButtonText}>Manage Workspace</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    marginTop: 10,
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
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#D9E7FF',
    top: '30%',
    left: '70%',
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginLeft: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 25,
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
  },
  workspaceCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 25,
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
  },
  workspaceDescription: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    marginTop: 4,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1.84,
    elevation: 1,
  },
  manageButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    width: width * 0.7,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    width: '100%',
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    marginLeft: 10,
  },
  signOutText: {
    color: '#F44336',
  },
});
