import AnchorQuestionModal from '@/components/AnchorQuestionModal';
import TasksDrawer from '@/components/TasksDrawer';
import WelcomeForm from '@/components/WelcomeForm';
import { useAuth } from '@/context/auth';
import { api } from '@/utils/api';
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function Home() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [joinedWorkspaces, setJoinedWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Welcome question modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
  const [welcomeQuestion, setWelcomeQuestion] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [mainDataType, setMainDataType] = useState('');

  // WelcomeForm modal state
  const [showWelcomeForm, setShowWelcomeForm] = useState(false);
  const [pendingWorkspace, setPendingWorkspace] = useState<any>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  useEffect(() => {
    loadAll();
  }, []);

  // In Lexi-only mode, redirect this screen straight into the Lexi workspace
  useEffect(() => {
    const redirectToLexi = async () => {
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
    };
    redirectToLexi();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded) {
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
  }, [fontsLoaded]);

  // Load data when user changes
  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  // Update joinedWorkspaces whenever user or workspaces change
  useEffect(() => {
    if (user && workspaces.length > 0) {
      let userWorkspaces = (user as any).workspaces;
      if (typeof userWorkspaces === 'string') {
        try {
          userWorkspaces = JSON.parse(userWorkspaces);
        } catch {
          userWorkspaces = [];
        }
      }
      if (!Array.isArray(userWorkspaces)) userWorkspaces = [];
      userWorkspaces = userWorkspaces.map(String); // ensure all are strings
      setJoinedWorkspaces(workspaces.filter((ws: any) => userWorkspaces.includes(String(ws.id))));
    } else {
      setJoinedWorkspaces([]);
    }
  }, [user, workspaces]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [workspacesData] = await Promise.all([
        api.getWorkspaces(),
      ]);
      setWorkspaces(workspacesData.workspaces || []);

      // Load user's joined workspaces from database
      if (user && user.workspaces) {
        const userWorkspaces = Array.isArray(user.workspaces) ? user.workspaces : [];
        const joinedWorkspacesList = workspacesData.workspaces?.filter((ws: any) =>
          userWorkspaces.includes(ws.id)
        ) || [];
        setJoinedWorkspaces(joinedWorkspacesList);
        console.log('[DEBUG] Loaded joined workspaces:', joinedWorkspacesList);
      } else {
        setJoinedWorkspaces([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (setUser) {
        setUser(null);
      }
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileMenuPress = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleMenuOption = (option: string) => {
    setShowProfileMenu(false);
    switch (option) {
      case 'signout':
        handleSignOut();
        break;
      case 'consent':
        Alert.alert('Consent Form', 'Consent form functionality would be implemented here.');
        break;
      case 'bug':
        Alert.alert('Report Bug', 'Bug reporting functionality would be implemented here.');
        break;
    }
  };

  const handleJoinWorkspace = async (workspace: any) => {
    if (!user || !user.email) {
      Alert.alert('Authentication Error', 'You must be logged in to join a workspace.');
      return;
    }

    console.log('[DEBUG] Showing welcome form for workspace:', workspace.id, workspace.name);

    // Show WelcomeForm first
    setPendingWorkspace(workspace);
    setShowWelcomeForm(true);
  };

  const handleWelcomeFormContinue = async () => {
    if (!pendingWorkspace || !user) {
      console.log('[DEBUG] Missing pendingWorkspace or user');
      return;
    }

    console.log('[DEBUG] WelcomeForm continued for workspace:', pendingWorkspace.id);

    try {
      // If user doesn't have a role yet, save them to database first
      if (!user.role) {
        console.log('[DEBUG] New user, saving to database first');
        const saveResult = await api.saveUser({
          email: user.email,
          name: user.name || 'New User',
          role: 'user'
        });

        if (saveResult.success && saveResult.user) {
          // Use the user data returned from the server
          const updatedUser = {
            ...user,
            id: saveResult.user.id, // Use the database ID instead of Google ID
            role: 'user' as const,
          };
          setUser(updatedUser);
        } else {
          throw new Error('Failed to save user data');
        }
      }

      // Close WelcomeForm
      setShowWelcomeForm(false);
      setPendingWorkspace(null);

      // Get welcome question for this workspace
      console.log('[DEBUG] Fetching welcome question for workspace:', pendingWorkspace.id);
      const welcomeData = await api.getWorkspaceAnchorQuestion(pendingWorkspace.id);

      if (welcomeData.anchor_question) {
        console.log('[DEBUG] Showing welcome question modal');
        // Show welcome question modal (user is not joined yet)
        setSelectedWorkspace(pendingWorkspace);
        setWelcomeQuestion(welcomeData.anchor_question);
        setWorkspaceName(welcomeData.workspace_name);
        console.log('[DEBUG] Setting mainDataType to:', welcomeData.main_data_type);
        setMainDataType(welcomeData.main_data_type || '');
        setShowWelcomeModal(true);
      } else {
        console.log('[DEBUG] No welcome question, joining workspace directly');
        // No welcome question, join workspace directly
        await api.joinWorkspace(user.id, pendingWorkspace.id);
        // Update joinedWorkspaces state immediately
        setJoinedWorkspaces((prev) => [...prev, pendingWorkspace]);
        // Navigate directly
        router.push(`/workspace/${pendingWorkspace.id}`);
      }
    } catch (e) {
      console.error('[DEBUG] Error in handleWelcomeFormContinue:', e);
      Alert.alert('Error', 'Could not proceed. Please try again.');
    }
  };

  const handleWelcomeFormClose = () => {
    setShowWelcomeForm(false);
    setPendingWorkspace(null);
  };

  const handleWelcomeAnswer = async (answer: string) => {
    console.log('[DEBUG] handleWelcomeAnswer called with answer:', answer);
    if (!selectedWorkspace || !user) {
      console.log('[DEBUG] Missing selectedWorkspace or user');
      return;
    }

    try {
      console.log('[DEBUG] Joining workspace with welcome answer');
      // Join the workspace with the user's original answer (no formatting)
      await api.joinWorkspace(user.id, selectedWorkspace.id, answer);

      // Update joinedWorkspaces state immediately
      setJoinedWorkspaces((prev) => [...prev, selectedWorkspace]);

      // Close modal and navigate
      setShowWelcomeModal(false);
      setSelectedWorkspace(null);
      setWelcomeQuestion('');
      setWorkspaceName('');
      setMainDataType('');

      // Navigate to the workspace page
      router.push(`/workspace/${selectedWorkspace.id}`);
    } catch (e) {
      console.error('[DEBUG] Error in handleWelcomeAnswer:', e);
      Alert.alert('Error', 'Could not save your answer. Please try again.');
    }
  };

  const handleWelcomeSkip = () => {
    console.log('[DEBUG] handleWelcomeSkip called');
    if (!selectedWorkspace || !user) {
      console.log('[DEBUG] Missing selectedWorkspace or user');
      return;
    }

    try {
      console.log('[DEBUG] Joining workspace without welcome answer');
      // Join the workspace without a welcome answer
      api.joinWorkspace(user.id, selectedWorkspace.id);

      // Update joinedWorkspaces state immediately
      setJoinedWorkspaces((prev) => [...prev, selectedWorkspace]);

      // Close modal and navigate (user is now joined)
      setShowWelcomeModal(false);
      setSelectedWorkspace(null);
      setWelcomeQuestion('');
      setWorkspaceName('');
      setMainDataType('');

      // Navigate to the workspace page
      router.push(`/workspace/${selectedWorkspace.id}`);
    } catch (e) {
      console.error('[DEBUG] Error in handleWelcomeSkip:', e);
      Alert.alert('Error', 'Could not join the workspace. Please try again.');
    }
  };

  const handleEnterWorkspace = (workspace: any) => {
    router.push(`/workspace/${workspace.id}`);
  };

  // Only show workspaces the user has not joined
  const availableToJoin = workspaces.filter(
    (ws: any) => !(user && Array.isArray((user as any).workspaces) && (user as any).workspaces.includes(ws.id))
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
          <Text style={styles.loadingText}>Loading your workspaces...</Text>
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
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDrawerVisible(true)}
            style={styles.tasksButton}
          >
            <Ionicons name="list-circle-outline" size={28} color="#4A90E2" />
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
                onPress={() => handleMenuOption('consent')}
              >
                <Ionicons name="document-text-outline" size={20} color="#4A90E2" />
                <Text style={styles.menuOptionText}>Consent Form</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleMenuOption('bug')}
              >
                <Ionicons name="bug-outline" size={20} color="#4A90E2" />
                <Text style={styles.menuOptionText}>Report Bug</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleMenuOption('signout')}
              >
                <Ionicons name="log-out-outline" size={20} color="#F44336" />
                <Text style={[styles.menuOptionText, styles.signOutText]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Joined Workspaces Section */}
          {joinedWorkspaces.length > 0 && (
            <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-circle-outline" size={24} color="#4A90E2" />
                <Text style={styles.sectionTitle}>Your Workspaces</Text>
              </View>
              {joinedWorkspaces.map((workspace, index) => (
                <Animated.View
                  key={workspace.id || `joined-${index}`}
                  style={[
                    styles.workspaceCard,
                    styles.joinedCard,
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
                    style={styles.enterButton}
                    onPress={() => handleEnterWorkspace(workspace)}
                  >
                    <Ionicons name="arrow-forward" size={16} color="#4A90E2" />
                    <Text style={styles.enterButtonText}>Enter Workspace</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          )}

          {/* Available Workspaces Section */}
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
              <Text style={styles.sectionTitle}>
                {availableToJoin.length > 0 ? 'Available to Join' : 'No Workspaces to Join'}
              </Text>
            </View>
            {availableToJoin.length === 0 ? (
              <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#4A90E2" />
                </View>
                <Text style={styles.emptyText}>All caught up!</Text>
                <Text style={styles.emptySubText}>You've joined all available communities.</Text>
              </Animated.View>
            ) : (
              availableToJoin.map((workspace, index) => (
                <Animated.View
                  key={workspace.id || `available-${index}`}
                  style={[
                    styles.workspaceCard,
                    styles.availableCard,
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
                    style={styles.joinButton}
                    onPress={() => handleJoinWorkspace(workspace)}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.joinButtonText}>Join Workspace</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </Animated.View>
        </ScrollView>

        <TasksDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          user={user}
          workspaceId={joinedWorkspaces[0]?.id}
        />

        {/* Welcome Question Modal */}
        <AnchorQuestionModal
          visible={showWelcomeModal}
          workspaceName={workspaceName}
          anchorQuestion={welcomeQuestion}
          mainDataType={mainDataType}
          onAnswer={handleWelcomeAnswer}
          onClose={handleWelcomeSkip}
        />

        {/* Welcome Form Modal */}
        <WelcomeForm
          visible={showWelcomeForm}
          workspace={pendingWorkspace}
          onContinue={handleWelcomeFormContinue}
          onClose={handleWelcomeFormClose}
        />
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
  loadingIcon: {
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
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
    backgroundColor: '#E7F3FF',
    top: '30%',
    left: '70%',
    opacity: 0.4,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  profileCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInitial: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
  },

  tasksButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
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
  joinedCard: {
    backgroundColor: '#F0F9EB', // Lighter green background for joined workspaces
    borderColor: '#A5D6A7',
    borderWidth: 1,
  },
  availableCard: {
    backgroundColor: '#E3F2FD', // Lighter blue background for available workspaces
    borderColor: '#90CAF9',
    borderWidth: 1,
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
    marginRight: 12,
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  workspaceDescription: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
  },
  joinButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
  },
  enterButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A90E2',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  enterButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: width * 0.7,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    marginLeft: 10,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  signOutText: {
    color: '#F44336',
  },

});
