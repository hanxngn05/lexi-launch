import { makeRequest } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function TasksDrawer({ visible, onClose, user, workspaceId }: {
  visible: boolean;
  onClose: () => void;
  user: any;
  workspaceId: string;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    if (visible) {
      fetchTasks();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const fetchTasks = async () => {
    if (!user || !workspaceId) return;
    setLoading(true);
    try {
      const res = await makeRequest(`/tasks/${workspaceId}/${user.id}`);
      setTasks(res.tasks || []);
    } catch (e) {
      setTasks([]);
    } finally {
      // Reduce loading time for better UX
      setTimeout(() => setLoading(false), 150);
    }
  };

  const handleAccept = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await makeRequest(`/tasks/${workspaceId}/${taskId}/accept`, { method: 'POST' });
      const acceptedTask = tasks.find(
        (t) => (t.id === taskId || t.task_id === taskId)
      );
      const area = acceptedTask?.Which_general_area_on_campus_are_you_reporting_from;
      // Navigate to the map screen with area and task param
      if (area && acceptedTask) {
        router.push(`/workspace/${workspaceId}?area=${encodeURIComponent(area)}&task=${encodeURIComponent(JSON.stringify(acceptedTask))}`);
        onClose && onClose();
      } else {
        await fetchTasks();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await makeRequest(`/tasks/${workspaceId}/${taskId}/decline`, { method: 'POST' });
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  // Only consider tasks with a valid task_status (created, assigned, accepted, completed)
  const validStatuses = ['created', 'assigned', 'accepted', 'completed'];
  const filteredTasks = tasks.filter(
    (task) => validStatuses.includes(task.task_status)
  );

  // Separate tasks
  // Active task session: accepted but not completed
  const activeTasks = filteredTasks.filter(
    (task) => task.task_status === 'accepted' && !task.time_completed
  );
  // Pending: not yet accepted
  const pendingTasks = filteredTasks.filter(
    (task) => (task.task_status === 'created' || task.task_status === 'assigned') && !task.time_task_responded && !task.time_completed
  );
  // Past tasks filtering
  const [pastTab, setPastTab] = useState<'completed' | 'expired'>('completed');
  const now = new Date();
  const EXPIRE_HOURS = 24;
  const completedTasks = tasks.filter(
    (task) => task.task_status === 'completed'
  );
  const expiredTasks = tasks.filter(
    (task) => task.task_status === 'incomplete' || task.task_status === 'declined'
  );

  // Handle submit response
  const handleSubmitResponse = (task: any) => {
    // Navigate to the map screen with area and task param
    const area = task?.Which_general_area_on_campus_are_you_reporting_from;
    if (area && task) {
      router.push(`/workspace/${workspaceId}?area=${encodeURIComponent(area)}&task=${encodeURIComponent(JSON.stringify(task))}`);
      onClose && onClose();
    }
  };

  // Handle form submission (dummy, replace with real logic)
  const handleFormSubmit = async (formData: any) => {
    if (!activeTask) return;
    try {
      // Save response (implement as needed)
      // await makeRequest(`/responses/${workspaceId}`, { method: 'POST', body: JSON.stringify(formData) });
      // Mark task as completed
      await makeRequest(`/tasks/${workspaceId}/${activeTask.id || activeTask.task_id}/complete`, { method: 'POST' });
      setShowFormModal(false);
      setActiveTask(null);
      await fetchTasks();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit response.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#4A90E2';
      case 'completed': return '#4CAF50';
      case 'incomplete': return '#FF9800';
      case 'declined': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return 'play-circle-outline';
      case 'completed': return 'checkmark-circle-outline';
      case 'incomplete': return 'time-outline';
      case 'declined': return 'close-circle-outline';
      default: return 'ellipse-outline';
    }
  };

  const formatTimeAssigned = (timestamp: string) => {
    if (!timestamp) return 'Time unknown';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) {
        return 'Just assigned';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch (error) {
      return 'Time unknown';
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[styles.drawer, { left: slideAnim }]}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="list-circle-outline" size={24} color="#4A90E2" />
              <Text style={styles.title}>Your Tasks</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#4A90E2" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading tasks...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.tasksContainer} showsVerticalScrollIndicator={false}>
              {/* Active Task Session */}
              {activeTasks.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="play-circle-outline" size={20} color="#4A90E2" />
                    <Text style={styles.sectionTitle}>Active Task</Text>
                  </View>
                  {activeTasks.map((task) => (
                    <View key={task.id || task.task_id} style={[styles.taskCard, styles.activeCard]}>
                      <View style={styles.taskHeader}>
                        <View style={styles.taskIcon}>
                          <Ionicons name="play-circle-outline" size={20} color="#4A90E2" />
                        </View>
                        <View style={styles.taskInfo}>
                          <Text style={styles.taskTitle}>{task.Which_general_area_on_campus_are_you_reporting_from || 'Unknown Location'}</Text>
                          <Text style={styles.taskWorkspace}>{task.workspace_name || 'Unknown Workspace'}</Text>
                          <Text style={styles.taskTime}>{formatTimeAssigned(task.time_task_assigned || task.timestamp)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.task_status) }]}>
                          <Text style={styles.statusText}>Active</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.submitButton}
                        onPress={() => handleSubmitResponse(task)}
                      >
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Submit Response</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Pending tasks */}
              {pendingTasks.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time-outline" size={20} color="#FF9800" />
                    <Text style={styles.sectionTitle}>Pending Tasks</Text>
                  </View>
                  {pendingTasks.map((task) => (
                    <View key={task.id || task.task_id} style={[styles.taskCard, styles.pendingCard]}>
                      <View style={styles.taskHeader}>
                        <View style={styles.taskIcon}>
                          <Ionicons name="time-outline" size={20} color="#FF9800" />
                        </View>
                        <View style={styles.taskInfo}>
                          <Text style={styles.taskTitle}>{task.Which_general_area_on_campus_are_you_reporting_from || 'Unknown Location'}</Text>
                          <Text style={styles.taskWorkspace}>{task.workspace_name || 'Unknown Workspace'}</Text>
                          <Text style={styles.taskTime}>{formatTimeAssigned(task.time_task_assigned || task.timestamp)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.task_status) }]}>
                          <Text style={styles.statusText}>Pending</Text>
                        </View>
                      </View>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.acceptButton]}
                          onPress={() => handleAccept(task.id || task.task_id)}
                          disabled={actionLoading === (task.id || task.task_id)}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          <Text style={styles.buttonText}>
                            {actionLoading === (task.id || task.task_id) ? 'Accepting...' : 'Accept'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.declineButton]}
                          onPress={() => handleDecline(task.id || task.task_id)}
                          disabled={actionLoading === (task.id || task.task_id)}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                          <Text style={styles.buttonText}>
                            {actionLoading === (task.id || task.task_id) ? 'Declining...' : 'Decline'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Empty State */}
              {pendingTasks.length === 0 && activeTasks.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-circle-outline" size={64} color="#4A90E2" />
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptySubtitle}>No pending tasks at the moment.</Text>
                </View>
              )}

              {/* Past Tasks Section */}
              {(completedTasks.length > 0 || expiredTasks.length > 0) && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="archive-outline" size={20} color="#9E9E9E" />
                    <Text style={styles.sectionTitle}>Past Tasks</Text>
                  </View>
                  <View style={styles.tabContainer}>
                    <TouchableOpacity
                      onPress={() => setPastTab('completed')}
                      style={[styles.tab, pastTab === 'completed' && styles.activeTab]}
                    >
                      <Text style={[styles.tabText, pastTab === 'completed' && styles.activeTabText]}>
                        Completed ({completedTasks.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPastTab('expired')}
                      style={[styles.tab, pastTab === 'expired' && styles.activeTab]}
                    >
                      <Text style={[styles.tabText, pastTab === 'expired' && styles.activeTabText]}>
                        Expired ({expiredTasks.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {pastTab === 'completed' ? (
                    completedTasks.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
                        <Text style={styles.emptyTitle}>No completed tasks</Text>
                      </View>
                    ) : (
                      completedTasks.map((task) => (
                        <View key={task.id || task.task_id} style={[styles.taskCard, styles.completedCard]}>
                          <View style={styles.taskHeader}>
                            <View style={styles.taskIcon}>
                              <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                            </View>
                            <View style={styles.taskInfo}>
                              <Text style={styles.taskTitle}>{task.Which_general_area_on_campus_are_you_reporting_from || 'Unknown Location'}</Text>
                              <Text style={styles.taskWorkspace}>{task.workspace_name || 'Unknown Workspace'}</Text>
                              <Text style={styles.taskTime}>{formatTimeAssigned(task.time_task_assigned || task.timestamp)}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                              <Text style={styles.statusText}>Completed</Text>
                            </View>
                          </View>
                        </View>
                      ))
                    )
                  ) : (
                    expiredTasks.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="time-outline" size={48} color="#FF9800" />
                        <Text style={styles.emptyTitle}>No expired tasks</Text>
                      </View>
                    ) : (
                      expiredTasks.map((task) => (
                        <View key={task.id || task.task_id} style={[styles.taskCard, styles.expiredCard]}>
                          <View style={styles.taskHeader}>
                            <View style={styles.taskIcon}>
                              <Ionicons name={task.task_status === 'incomplete' ? 'time-outline' : 'close-circle-outline'} size={20} color={task.task_status === 'incomplete' ? '#FF9800' : '#F44336'} />
                            </View>
                            <View style={styles.taskInfo}>
                              <Text style={styles.taskTitle}>{task.Which_general_area_on_campus_are_you_reporting_from || 'Unknown Location'}</Text>
                              <Text style={styles.taskWorkspace}>{task.workspace_name || 'Unknown Workspace'}</Text>
                              <Text style={styles.taskTime}>{formatTimeAssigned(task.time_task_assigned || task.timestamp)}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: task.task_status === 'incomplete' ? '#FF9800' : '#F44336' }]}>
                              <Text style={styles.statusText}>
                                {task.task_status === 'incomplete' ? 'Expired' : 'Declined'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))
                    )
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#888',
  },
  tasksContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
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
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#fff',
  },
  taskCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCard: {
    backgroundColor: '#e0f7fa', // Lighter blue background for active tasks
  },
  pendingCard: {
    backgroundColor: '#fff3e0', // Lighter orange background for pending tasks
  },
  completedCard: {
    backgroundColor: '#e8f5e9', // Lighter green background for completed tasks
  },
  expiredCard: {
    backgroundColor: '#ffebee', // Lighter red background for expired tasks
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2f7', // Light blue background for icons
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  taskWorkspace: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  taskArea: {
    fontSize: 14,
    color: '#666',
  },
  taskTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#4A90E2',
  },
  declineButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
