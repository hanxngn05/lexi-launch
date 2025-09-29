import TasksForm from '@/components/TasksForm';
import TypoDetectingTextInput from '@/components/TypoDetectingTextInput';
import { AREA_COORDINATES } from '@/constants/areaCoordinates';
import { useAuth } from '@/context/auth';
import { api, makeRequest } from '@/utils/api';
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { MapPressEvent, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// This is the initial structure for a new workspace file
const initialWorkspaceStructure = (id: string, user: any) => ({
    id: id,
    name: "Lexi",
    description: "A language speaking community",
    questions: [
      { "text": "What language did you hear?", "type": "text" },
      { "text": "Take a picture", "type": "image" },
      { "text": "Record the conversation", "type": "audio" }
    ],
    developer: "hn103@wellesley.edu",
    user: { email: user?.email, name: user?.name },
    responses: []
});

export default function WorkspaceScreen() {
  const { id } = useLocalSearchParams() as { id: string };
  const params = useLocalSearchParams();
  const areaParam = params.area as string | undefined;
  const taskParam = useMemo(
    () => (params.task ? JSON.parse(params.task as string) : undefined),
    [params.task]
  );
  const router = useRouter();

  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]); // User-generated pins
  const [loading, setLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false); // Does the user exist in users.json?
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [isMapRecording, setIsMapRecording] = useState(false);

  const { user, setUser } = useAuth();

  // MAP STATE AND LOGIC
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 42.2935,
    longitude: -71.3056,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [bubbleAnimMap, setBubbleAnimMap] = useState<{ [key: string]: Animated.Value[] }>({});
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const didSelectPinRef = useRef(false);

  // INPUT FORM STATE (FOR MAP PINS)
  const [modalVisible, setModalVisible] = useState(false);
  const [mapRecording, setMapRecording] = useState<Audio.Recording | null>(null);
  const [mapAudioUri, setMapAudioUri] = useState<string | null>(null);
  const [newMarkerImage, setNewMarkerImage] = useState<string | null>(null);
  const [conversationTopic, setConversationTopic] = useState('');
  const [step, setStep] = useState(0);
  const [newMarkerCoords, setNewMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');

  // Add state for question answers
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);

  // Add state for pin question answers
  const [pinQuestionAnswers, setPinQuestionAnswers] = useState<string[]>([]);

  // Add state for active task and bottom sheet/modal
  const [activeTask, setActiveTask] = useState<any>(null);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskPin, setTaskPin] = useState<{ latitude: number; longitude: number } | null>(null);

  // Add state for form modal and answers
  const [showFormModal, setShowFormModal] = useState(false);
  const [formAnswers, setFormAnswers] = useState<string[]>([]);

  // Add state for search functionality
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAreas, setFilteredAreas] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadInitialData();
    }
  }, [id, user]);

  useEffect(() => {
    if (areaParam && mapReady) {
      zoomToArea(areaParam);
    }
    // Only open the sheet if the task is not already active
    if (mapReady && taskParam && (!activeTask || activeTask.task_id !== taskParam.task_id)) {
      openTaskSheet(taskParam);
    }
  }, [areaParam, mapReady, taskParam]);

  const loadInitialData = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      // Fetch workspace info and user data in parallel
      const [workspaceInfo, userData, responsesData] = await Promise.all([
        makeRequest(`/workspaces/${id}`),
        api.getUserByEmail(user.email),
        api.getResponsesForWorkspace(id)
      ]);

      // Check if user has joined this workspace
      if (userData && Array.isArray(userData.workspaces) && userData.workspaces.includes(id)) {
        setHasJoined(true);
      } else {
        setHasJoined(false);
      }

      setWorkspaceInfo(workspaceInfo);

      // Transform database responses to frontend marker format
      const transformedMarkers = (responsesData.responses || []).map((response: any) => {
        // Extract answers from the response columns
        const answers: string[] = [];
        if (workspaceInfo?.questions) {
          workspaceInfo.questions.forEach((question: any) => {
            // Use the same sanitization logic as the backend
            const columnName = question.text.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');

            // Try different variations of the column name
            let answer = response[columnName];
            if (answer === undefined) {
              answer = response[`\`${columnName}\``];
            }
            if (answer === undefined) {
              // Try without backticks
              answer = response[columnName.replace(/`/g, '')];
            }
            if (answer === undefined) {
              // Try with backticks
              answer = response[`\`${columnName.replace(/`/g, '')}\``];
            }
            if (answer === undefined) {
              answer = '';
            }

            answers.push(answer);
          });
        }

        return {
          id: response.id,
          timestamp: response.timestamp,
          coordinates: {
            latitude: parseFloat(response.latitude),
            longitude: parseFloat(response.longitude)
          },
          answers: answers,
          user_id: response.user_id
        };
      });

      // Filter out any markers without valid coordinates
      const validMarkers = transformedMarkers.filter((marker: any) =>
        marker.coordinates &&
        typeof marker.coordinates.latitude === 'number' &&
        typeof marker.coordinates.longitude === 'number' &&
        !isNaN(marker.coordinates.latitude) &&
        !isNaN(marker.coordinates.longitude)
      );

      setMarkers(validMarkers);

    } catch (error) {
      console.error('Error loading workspace data:', error);
    } finally {
      // Reduce loading time for better UX
      setTimeout(() => setLoading(false), 200);
    }
  };

  const refreshMapData = async () => {
    if (!id || !user) return;
    setRefreshing(true);
    try {
      // Fetch the dynamic responses for this workspace from database
      const responsesData = await api.getResponsesForWorkspace(id);

      // Transform database responses to frontend marker format
      const transformedMarkers = (responsesData.responses || []).map((response: any) => {
        // Extract answers from the response columns
        const answers: string[] = [];
        if (workspaceInfo?.questions) {
          workspaceInfo.questions.forEach((question: any) => {
            // Use the same sanitization logic as the backend
            const columnName = question.text.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');

            // Try different variations of the column name
            let answer = response[columnName];
            if (answer === undefined) {
              answer = response[`\`${columnName}\``];
            }
            if (answer === undefined) {
              // Try without backticks
              answer = response[columnName.replace(/`/g, '')];
            }
            if (answer === undefined) {
              // Try with backticks
              answer = response[`\`${columnName.replace(/`/g, '')}\``];
            }
            if (answer === undefined) {
              answer = '';
            }

            answers.push(answer);
          });
        }

        return {
          id: response.id,
          timestamp: response.timestamp,
          coordinates: {
            latitude: parseFloat(response.latitude),
            longitude: parseFloat(response.longitude)
          },
          answers: answers,
          user_id: response.user_id
        };
      });

      // Filter out any markers without valid coordinates
      const validMarkers = transformedMarkers.filter((marker: any) =>
        marker.coordinates &&
        typeof marker.coordinates.latitude === 'number' &&
        typeof marker.coordinates.longitude === 'number' &&
        !isNaN(marker.coordinates.latitude) &&
        !isNaN(marker.coordinates.longitude)
      );

      setMarkers(validMarkers);

    } catch (error) {
      console.error('Error refreshing map data:', error);
      Alert.alert('Error', 'Could not refresh workspace data.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (workspaceInfo && workspaceInfo.questions) {
      setQuestionAnswers(Array(workspaceInfo.questions.length).fill(''));
    }
  }, [workspaceInfo]);

  const resetMapForm = () => {
    setNewMarkerLabel('');
    setConversationTopic('');
    setNewMarkerImage(null);
    setMapAudioUri(null);
    setStep(0);
    setNewMarkerCoords(null);
    setIsMapRecording(false);
  };

  useEffect(() => {
    if (selectedPin) {
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [selectedPin]);

  useEffect(() => {
    const newMap: { [key: string]: Animated.Value[] } = {};
    (markers || []).forEach((marker) => {
      const key = `${marker.coordinates.latitude},${marker.coordinates.longitude}`;
      const anims = Array(3).fill(null).map(() => new Animated.Value(0));
      newMap[key] = anims;
      anims.forEach((anim, i) => {
        const loop = () => {
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 5000, delay: i * 100, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 5000, useNativeDriver: true }),
          ]).start(loop);
        };
        loop();
      });
    });
    setBubbleAnimMap(newMap);
  }, [markers]);

  // Initialize pinQuestionAnswers when modal opens
  useEffect(() => {
    if (modalVisible && workspaceInfo?.questions.length > 0) {
      setPinQuestionAnswers(Array(workspaceInfo.questions.length).fill(''));
    }
  }, [modalVisible, workspaceInfo?.questions.length]);

  const deletePin = async (pinToDelete: any) => {
    try {
      // Remove the pin from the local state
      const newMarkers = markers.filter(
        (marker) => marker.id !== pinToDelete.id
      );

      setMarkers(newMarkers);
      setSelectedPin(null);
      setDetailsVisible(false);

      // Note: Backend deletion would need to be implemented
      // For now, we just update the local state
      console.log('Pin deleted locally. Backend deletion not yet implemented.');
    } catch (error) {
      console.error('Error deleting pin:', error);
      Alert.alert('Error', 'Could not delete the pin.');
    }
  };

  const handleQuestionAnswerChange = (index: number, value: string) => {
    const newAnswers = [...questionAnswers];
    newAnswers[index] = value;
    setQuestionAnswers(newAnswers);
  };

  const handleJoinSubmit = async () => {
    if (!user) {
      Alert.alert("Authentication error", "You must be logged in to join.");
      return;
    }
    // Validate all questions are answered
    if (workspaceInfo?.questions && questionAnswers.some(ans => !ans.trim())) {
      Alert.alert("Incomplete", "Please answer all questions to join.");
      return;
    }
    // You can include questionAnswers in the user join logic or save as needed
    const success = await api.saveUser({ email: user.email, name: user.name || 'New User', role: 'user' });
    if (success) {
      // Call backend to join workspace
      try {
        await makeRequest(`/users/${user.id}/join_workspace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: id }),
        });
        // Refetch user object to get updated workspaces
        if (setUser) {
          const updatedUser = await api.getUserByEmail(user.email);
          if (updatedUser) setUser(updatedUser);
          // Update hasJoined based on the new user object
          if (updatedUser && Array.isArray(updatedUser.workspaces) && updatedUser.workspaces.includes(id)) {
            setHasJoined(true);
          } else {
            setHasJoined(false);
          }
        }
        setOnboardingVisible(false);
        Alert.alert("Welcome!", "You have successfully joined the workspace.");
      } catch (e) {
        Alert.alert("Join Failed", "Could not join the workspace. Please try again.");
      }
    } else {
      Alert.alert("Registration Failed", "Could not save your user information. Please try again.");
    }
  };

  const handleBackToHome = () => {
    // Stay within current workspace instead of routing to a general home
    router.replace(`/workspace/${id}`);
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (didSelectPinRef.current) {
      didSelectPinRef.current = false;
      return;
    }
    // Only allow pin creation if the user has joined
    if (!hasJoined) {
        Alert.alert("Join Workspace", "Please join the workspace to add a pin. Tap the icon in the corner.");
        return;
    }

    const { coordinate } = event.nativeEvent;
    setNewMarkerCoords(coordinate);
    setModalVisible(true);
  };

  const handleMapPickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access media library is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setNewMarkerImage(result.assets[0].uri);
    }
  };

  const handleImagePick = async () => {
    try {
      console.log('Requesting photo library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission status:', status);

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'This app needs access to your photo library to upload images. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        aspect: [1, 1],
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('Selected image URI:', imageUri);

        const newAnswers = [...pinQuestionAnswers];
        newAnswers[step] = imageUri;
        setPinQuestionAnswers(newAnswers);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        'Error',
        'Failed to open image picker. Please try again or restart the app.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Try Again', onPress: handleImagePick }
        ]
      );
    }
  };

  const handleMapStartRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setMapRecording(recording);
      setIsMapRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const handleMapStopRecording = async () => {
    if (!mapRecording) return;
    await mapRecording.stopAndUnloadAsync();
    const uri = mapRecording.getURI();
    setMapAudioUri(uri);
    setMapRecording(null);
    setIsMapRecording(false);
  };

  const handleMapPlayAudio = async () => {
    if (!mapAudioUri) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: mapAudioUri });
      await sound.playAsync();
    } catch (error) {
      console.error('Playback failed', error);
    }
  };

  const playPinAudio = async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (error) {
      console.error("Couldn't play audio", error);
      Alert.alert("Error", "Could not play the audio file.");
    }
  };

  const handleMapFormSubmit = async () => {
    if (!newMarkerCoords) {
      Alert.alert('Missing Information', 'Please select a location on the map.');
      return;
    }
    if (questions.length > 0 && pinQuestionAnswers.some(ans => !ans.trim())) {
      Alert.alert('Incomplete', 'Please answer all questions for this pin.');
      return;
    }
    const newPin = {
      timestamp: new Date().toISOString(),
      coordinates: newMarkerCoords,
      answers: pinQuestionAnswers,
      user_id: user?.id,
    };

    const updatedResponses = [...markers, newPin];
    await api.saveResponsesForWorkspace(id, { responses: updatedResponses });

    setMarkers(updatedResponses);
    setModalVisible(false);
    resetMapForm();
    setSelectedPin(null);
  };

  // Only use questions from the workspace record (workspaces table)
  const questions = Array.isArray(workspaceInfo?.questions)
    ? workspaceInfo.questions
    : (typeof workspaceInfo?.questions === 'string'
        ? JSON.parse(workspaceInfo.questions)
        : []);

  if (modalVisible) {
    console.log('Question text:', questions[step]?.text);
  }

  // When opening the modal, always reset step to 0
  const openPinModal = () => {
    setStep(0);
    setModalVisible(true);
  };

  // Add this function to zoom to area
  const zoomToArea = (areaName: string) => {
    const coords = AREA_COORDINATES[areaName as keyof typeof AREA_COORDINATES];
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 1000);
    }
  };

  // Function to open the task sheet with a task
  const openTaskSheet = (task: any) => {
    setActiveTask(task);
    setShowTaskSheet(true);
    setTaskPin(null);
    if (task && task.Which_general_area_on_campus_are_you_reporting_from) {
      zoomToArea(task.Which_general_area_on_campus_are_you_reporting_from);
    }
  };

  // Search functionality
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim()) {
      const filtered = Object.keys(AREA_COORDINATES).filter(area =>
        area.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredAreas(filtered);
      setShowSearchResults(true);
    } else {
      setFilteredAreas([]);
      setShowSearchResults(false);
    }
  };

  const handleSelectArea = (areaName: string) => {
    setSearchQuery(areaName);
    setShowSearchResults(false);
    zoomToArea(areaName);
  };

  const handleSearchFocus = () => {
    setSearchVisible(true);
    if (searchQuery.trim()) {
      setShowSearchResults(true);
    }
  };

  const handleSearchBlur = () => {
    // Small delay to allow for selection
    setTimeout(() => {
      setShowSearchResults(false);
    }, 200);
  };

  // Zoom functions
  const handleZoomIn = () => {
    if (mapRef.current) {
      const newRegion = {
        ...region,
        latitudeDelta: region.latitudeDelta * 0.5,
        longitudeDelta: region.longitudeDelta * 0.5,
      };
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const newRegion = {
        ...region,
        latitudeDelta: region.latitudeDelta * 2,
        longitudeDelta: region.longitudeDelta * 2,
      };
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  // On map tap for a task
  const handleTaskMapPress = (event: MapPressEvent) => {
    if (showTaskSheet) {
      setTaskPin(event.nativeEvent.coordinate);
      setShowFormModal(true); // Open the form immediately after pin
    } else {
      handleMapPress(event);
    }
  };

  // On form submit
  const handleSubmitTaskForm = async (answersFromForm?: string[]) => {
    if (!activeTask || !taskPin || !workspaceInfo?.questions) return;
    // Only send answers for questions that are not the general area
    const filteredQuestions = workspaceInfo.questions.filter(
      (qq: any) => qq.text !== 'Which general area on campus are you reporting from?'
    );
    const payload = {
      answers: answersFromForm || formAnswers,
      latitude: taskPin.latitude,
      longitude: taskPin.longitude,
    };
    await makeRequest(`/tasks/${id}/${activeTask.id || activeTask.task_id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowFormModal(false);
    setShowTaskSheet(false);
    setActiveTask(null);
    setTaskPin(null);
    setFormAnswers([]);
  };

  // Submit handler for completing the task
  const handleSubmitTaskPin = async () => {
    if (!activeTask || !taskPin) return;
    try {
      await makeRequest(`/tasks/${id}/${activeTask.id || activeTask.task_id}/complete`, { method: 'POST' });
      setShowTaskSheet(false);
      setActiveTask(null);
      setTaskPin(null);
      // Optionally refresh tasks or map data here
    } catch (e) {
      Alert.alert('Error', 'Failed to submit your location.');
    }
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading workspace...</Text>
        </View>
      </View>
    );
  }

  if (!workspaceInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Workspace Not Found</Text>
          <Text style={styles.errorSubtitle}>The workspace you're looking for doesn't exist or you don't have access to it.</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToHome}>
            <Text style={styles.backButtonText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace(`/workspace/${id}`)}>
          <Ionicons name="arrow-back" size={20} color="#4A90E2" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.workspaceTitle}>{workspaceInfo.name}</Text>
          <Text style={styles.entryCount}>{markers.length} entries</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={refreshMapData} disabled={refreshing}>
          <Ionicons name="refresh" size={16} color={refreshing ? "#9CA3AF" : "#4A90E2"} />
          <Text style={[styles.refreshButtonText, refreshing && styles.refreshButtonDisabled]}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Go Back to Home Screen Button */}
      <View style={styles.homeButtonContainer}>
        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace(`/workspace/${id}`)}>
          <Ionicons name="home" size={20} color="#FFFFFF" />
          {/* <Text style={styles.homeButtonText}>Home</Text> */}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for places..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setFilteredAreas([]);
                setShowSearchResults(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && filteredAreas.length > 0 && (
          <View style={styles.searchResults}>
            <ScrollView style={styles.searchResultsList} nestedScrollEnabled>
              {filteredAreas.map((area, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectArea(area)}
                >
                  <Ionicons name="location-outline" size={16} color="#4A90E2" />
                  <Text style={styles.searchResultText}>{area}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleTaskMapPress}
        showsUserLocation
        showsMyLocationButton
        onMapReady={() => setMapReady(true)}
      >
        {(markers || []).map((marker, index) => {
          if (!marker.coordinates || typeof marker.coordinates.latitude !== 'number' || typeof marker.coordinates.longitude !== 'number') return null;
          const key = `${marker.coordinates.latitude},${marker.coordinates.longitude}`;
          const anims = bubbleAnimMap[key];
          return (
            <Marker
              key={index}
              coordinate={marker.coordinates}
              title={marker.label}
              onPress={() => {
                setSelectedPin(marker);
                didSelectPinRef.current = true;
                setDetailsVisible(true);
              }}
            >
              <View style={styles.markerContainer}>
                {anims && anims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.bubble,
                      {
                        transform: [{ scale: anim }],
                        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                      },
                    ]}
                  />
                ))}
                <View style={styles.pin}>
                  <Image
                    source={require('../../assets/images/lexi_icon.png')}
                    style={styles.pinImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </Marker>
          );
        })}

        {/* Temporary marker for pin placement */}
        {newMarkerCoords && (
          <Marker coordinate={newMarkerCoords}>
            <View style={styles.tempPin}>
              <Image
                source={require('../../assets/images/lexi_icon.png')}
                style={styles.tempPinImage}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}
        {/* Task pin marker */}
        {taskPin && (
          <Marker coordinate={taskPin}>
            <View style={styles.taskPin}>
              <Image
                source={require('../../assets/images/lexi_icon.png')}
                style={styles.taskPinImage}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Enhanced Floating Action Button */}
      <View style={styles.bottomRightContainer}>
        <TouchableOpacity
          style={styles.formToggleButton}
          onPress={() => {
            if (!hasJoined) {
              setOnboardingVisible(true);
            } else {
              openPinModal();
            }
          }}
        >
          <Image
            source={require('../../assets/images/lexi_icon.png')}
            style={styles.formToggleButtonIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Zoom Controls - Bottom Right */}
      <View style={styles.zoomContainer}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={20} color="#4A90E2" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      {/* Pin Creation Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.topBarForm}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setNewMarkerCoords(null);
                setNewMarkerLabel('');
                setPinQuestionAnswers([]);
                setStep(0);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((step + 1) / questions.length) * 100}%` },
                ]}
              />
            </View>
          </View>
          <Text style={styles.title}>
            {questions[step]?.text || 'NO QUESTION TEXT'}
          </Text>
          <View style={styles.content}>
            {questions[step]?.type === 'dropdown' && questions[step]?.text === 'Which general area on campus are you reporting from?' ? (
              <Picker
                selectedValue={pinQuestionAnswers[step] || ''}
                onValueChange={(val: string) => {
                  const newAnswers = [...pinQuestionAnswers];
                  newAnswers[step] = val;
                  setPinQuestionAnswers(newAnswers);
                }}
                style={{height: 50, width: '100%'}}>
                <Picker.Item label="Select an area..." value="" />
                {questions[step]?.options && questions[step].options.map((opt: string, i: number) => (
                  <Picker.Item key={i} label={opt} value={opt} />
                ))}
              </Picker>
            ) : (
              questions[step]?.type === 'text' ? (
                                  <TypoDetectingTextInput
                    value={pinQuestionAnswers[step] || ''}
                    onChangeText={(val: string) => {
                      const newAnswers = [...pinQuestionAnswers];
                      newAnswers[step] = val;
                      setPinQuestionAnswers(newAnswers);
                    }}
                    placeholder="Type your answer..."
                    style={styles.text}
                    multiline
                  />
              ) : questions[step]?.type === 'image' ? (
                <View style={styles.uploadContainer}>
                  <TouchableOpacity
                    onPress={handleImagePick}
                    style={{ width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' }}
                  >
                    {pinQuestionAnswers[step] ? (
                      <Image
                        source={{ uri: pinQuestionAnswers[step] }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.placeholderContent}>
                        <Image
                          source={require('../../assets/images/upload.png')}
                          style={{ width: 50, height: 50 }}
                          resizeMode="contain"
                        />
                        <Text style={styles.uploadText}>Tap to select image</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {pinQuestionAnswers[step] && (
                    <TouchableOpacity
                      onPress={() => {
                        const newAnswers = [...pinQuestionAnswers];
                        newAnswers[step] = '';
                        setPinQuestionAnswers(newAnswers);
                      }}
                      style={styles.imageCancelButton}
                    >
                      <Text style={styles.imageCancelButtonText}>Remove Image</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Image Upload Options',
                        'Choose how to add an image:',
                        [
                          { text: 'Photo Library', onPress: handleImagePick },
                          {
                            text: 'Enter URL/Description',
                            onPress: () => {
                              const newAnswers = [...pinQuestionAnswers];
                              newAnswers[step] = 'image_url_or_description';
                              setPinQuestionAnswers(newAnswers);
                            }
                          },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    }}
                    style={[styles.imageCancelButton, { marginTop: 10 }]}
                  >
                    <Text style={styles.imageCancelButtonText}>Alternative Options</Text>
                  </TouchableOpacity>
                </View>
              ) : questions[step]?.type === 'audio' ? (
                <View style={styles.voiceContainer}>
                  <TouchableOpacity
                    onPress={isMapRecording ? handleMapStopRecording : async () => {
                      try {
                        await Audio.requestPermissionsAsync();
                        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
                        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                        setMapRecording(recording);
                        setIsMapRecording(true);
                      } catch (err) {
                        console.error('Failed to start recording', err);
                      }
                    }}
                    style={styles.recordButton}
                  >
                    <Text style={styles.recordIcon}>{isMapRecording ? '●' : '▶'}</Text>
                  </TouchableOpacity>
                  {pinQuestionAnswers[step] && !isMapRecording && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const { sound } = await Audio.Sound.createAsync({ uri: pinQuestionAnswers[step] });
                          await sound.playAsync();
                        } catch (error) {
                          console.error('Playback failed', error);
                        }
                      }}
                      style={styles.playButton}
                    >
                      <Text style={styles.playButtonText}>PLAY RECORDING</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null
            )}
            {questions[step]?.type === 'image' && pinQuestionAnswers[step] === 'image_url_or_description' && (
              <View style={styles.textInputContainer}>
                <Text style={styles.inputLabel}>Enter image URL or description:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter image URL or describe the image..."
                  value={pinQuestionAnswers[step] === 'image_url_or_description' ? '' : pinQuestionAnswers[step]}
                  onChangeText={(text) => {
                    const newAnswers = [...pinQuestionAnswers];
                    newAnswers[step] = text;
                    setPinQuestionAnswers(newAnswers);
                  }}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
            {/* Navigation Buttons */}
                          {questions.length === 1 ? (
                <View style={[
                  styles.bottomNavFullWidth,
                  questions[step]?.text === 'Which general area on campus are you reporting from?'
                    ? styles.bottomNavGeneralArea
                    : null
                ]}>
                  <TouchableOpacity
                    style={styles.navButtonFull}
                    onPress={handleMapFormSubmit}
                    disabled={pinQuestionAnswers.some(ans => !ans)}
                  >
                    <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Submit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[
                  styles.bottomNav,
                  questions[step]?.text === 'Which general area on campus are you reporting from?'
                    ? styles.bottomNavGeneralArea
                    : null
                ]}>
                                  {step > 0 && (
                    <TouchableOpacity
                      style={styles.navButtonLeft}
                      onPress={() => setStep(step - 1)}
                    >
                      <Text style={[styles.navButtonText, { color: '#4A90E2' }]}>Back</Text>
                    </TouchableOpacity>
                  )}
                  {step < questions.length - 1 ? (
                    <TouchableOpacity
                      style={styles.navButtonRight}
                      onPress={() => {
                        if (step < questions.length - 1) setStep(step + 1);
                      }}
                      disabled={!pinQuestionAnswers[step] || (questions[step]?.type !== 'text' && !pinQuestionAnswers[step])}
                    >
                      <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Next</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.navButtonFull}
                      onPress={handleMapFormSubmit}
                      disabled={pinQuestionAnswers.some(ans => !ans)}
                    >
                      <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Submit</Text>
                    </TouchableOpacity>
                  )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {selectedPin && detailsVisible && (
        <AnimatedPressable
          style={[styles.detailsContainer, { transform: [{ translateY: slideAnim }] }]}
          onPress={() => setDetailsVisible(false)}
        >
            <View style={styles.detailsContent}>
                <Text style={styles.detailsTitle}>Pin Details</Text>
                {Array.isArray(workspaceInfo?.questions) && workspaceInfo.questions
                  .filter((q: any) => q.text !== 'Which general area on campus are you reporting from?')
                  .map((q: any, idx: number) => {
                    // Find the original index to get the correct answer
                    const originalIdx = workspaceInfo.questions.findIndex((originalQ: any) => originalQ.text === q.text);
                    return (
                      <View key={idx} style={{ marginBottom: 10 }}>
                        <Text style={{ fontWeight: 'bold', color: '#333' }}>{q.text}</Text>
                        <Text style={{ color: '#555', marginLeft: 8 }}>
                          {selectedPin.answers && selectedPin.answers[originalIdx] ? selectedPin.answers[originalIdx] : <Text style={{ color: '#aaa' }}>[No answer]</Text>}
                        </Text>
                      </View>
                    );
                  })}
                {selectedPin.imageUri && (
                    <Image source={{ uri: selectedPin.imageUri }} style={styles.detailsImage} />
                )}
                {selectedPin.audioUri && (
                    <TouchableOpacity style={styles.formButton} onPress={() => playPinAudio(selectedPin.audioUri)}>
                        <Text style={styles.buttonText}>Play Recording</Text>
                    </TouchableOpacity>
                )}
            </View>
        </AnimatedPressable>
      )}

      {/* Onboarding Form Modal */}
      <Modal
        visible={onboardingVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setOnboardingVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Join {workspaceInfo?.name}</Text>
              <Text style={styles.modalSubtitle}>
                To start adding pins to this workspace, please confirm your registration.
              </Text>

              {/* Developer-created Questions (from workspace record only) */}
              {questions.length > 0 && questions.map((q: any, idx: number) => (
                <View style={styles.welcomeQuestionContainer} key={idx}>
                  <Text style={styles.welcomeQuestionLabel}>{q.text}</Text>
                  {q.type === 'dropdown' && q.text === 'Which general area on campus are you reporting from?' ? (
                    <View style={styles.welcomePickerContainer}>
                      <Picker
                        selectedValue={questionAnswers[idx] || ''}
                        onValueChange={(val: string) => handleQuestionAnswerChange(idx, val)}
                        style={styles.welcomePicker}>
                        <Picker.Item label="Select an area..." value="" />
                        {q.options && q.options.map((opt: string, i: number) => (
                          <Picker.Item key={i} label={opt} value={opt} />
                        ))}
                      </Picker>
                    </View>
                  ) : (
                    <TextInput
                      style={styles.welcomeTextInput}
                      value={questionAnswers[idx] || ''}
                      onChangeText={val => handleQuestionAnswerChange(idx, val)}
                      placeholder="Type your answer..."
                      multiline={q.type === 'text'}
                      placeholderTextColor="#9CA3AF"
                    />
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.formButton} onPress={handleJoinSubmit}>
                <Text style={styles.buttonText}>Confirm & Join</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setOnboardingVisible(false)}
              >
                 <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Task bottom sheet/modal */}
      {showTaskSheet && activeTask && (
        <View style={styles.taskBottomSheet}>
                    <View style={styles.taskSheetHeader}>
            <View style={styles.taskSheetIndicator} />
            <Text style={styles.taskSheetTitle}>New Task</Text>
          </View>

          <View style={styles.taskContentContainer}>
            <Text style={styles.taskInstructionText}>
              Click where you are at in {activeTask.Which_general_area_on_campus_are_you_reporting_from}
            </Text>
            {!taskPin && (
              <View style={styles.taskHintContainer}>
                <Ionicons name="location-outline" size={20} color="#9CA3AF" />
                <Text style={styles.taskHintText}>Tap on the map to drop a pin</Text>
              </View>
            )}
          </View>

          <View style={styles.taskButtonsContainer}>
            {taskPin && (
              <TouchableOpacity
                style={styles.taskSubmitButton}
                onPress={handleSubmitTaskPin}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.taskSubmitButtonText}>Submit Location</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.taskCancelButton}
              onPress={() => { setShowTaskSheet(false); setActiveTask(null); setTaskPin(null); }}
            >
              <Text style={styles.taskCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task form modal */}
      {showFormModal && activeTask && (
        <Modal visible={showFormModal} transparent animationType="slide" onRequestClose={() => setShowFormModal(false)}>
          <View style={styles.taskFormModalOverlay}>
            <View style={styles.taskFormModalContainer}>
              <View style={styles.taskFormHeader}>
                <View style={styles.taskFormIndicator} />
                <Text style={styles.taskFormTitle}>Complete Task</Text>
                <TouchableOpacity
                  style={styles.taskFormCloseButton}
                  onPress={() => setShowFormModal(false)}
                >
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={styles.taskFormContent}
                showsVerticalScrollIndicator={false}
              >
                <TasksForm
                  questions={Array.isArray(workspaceInfo?.questions) ? workspaceInfo.questions.filter((q: any) => q.text !== 'Which general area on campus are you reporting from?') : []}
                  initialAnswers={formAnswers}
                  onSubmit={(answers) => handleSubmitTaskForm(answers)}
                  onCancel={() => setShowFormModal(false)}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF',
    padding: 24,
    paddingTop: 60,
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
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
  },
  notFoundText: {
    fontSize: 18,
    color: '#888',
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 5,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  pinImage: {
    width: 24,
    height: 24,
  },
  bubble: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  detailsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  detailsContent: {
    // added for potential future styling inside the card
  },
  detailsTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 10,
  },
  detailsImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginVertical: 10,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  bottomRightContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 100,
    position: 'absolute',
    bottom: 40,
    right: 10,
    alignItems: 'center',
  },
  formToggleButton: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  formToggleButtonIcon: {
    width: 50,
    height: 50,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
  },
  modalTitle: {
    marginTop: 10,
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '600',
    color: '#000',
    marginBottom: 18,
    marginLeft: 20,
    padding: 8,
    zIndex: 10,
  },
   modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#495057',
    marginBottom: 8,
  },
  imagePreview: {
    width: 180,
    height: 180,
    borderRadius: 20,
    marginVertical: 10,
  },
  formButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  recordingButton: {
    backgroundColor: 'red',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center'
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  questionContainer: {
    marginBottom: 15,
  },
  topBarForm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  progressContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  title: {
    marginTop: 10,
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '600',
    color: '#000',
    marginBottom: 18,
    marginLeft: 20,
    padding: 8,
    zIndex: 10,
  },
  content: {
    marginBottom: 40,
    marginLeft: 20,
    marginRight: 20,
    marginTop: -10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  text: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 10,
  },
  uploadWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadContainer: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
  },
  imageCancelButton: {
    padding: 5,
  },
  imageCancelButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#666',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
  },
  recordIcon: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
  playButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
  },
  playButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  secondaryButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  button: {
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
  },
  bottomNavFullWidth: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  bottomNavGeneralArea: {
    paddingTop: 160,
  },
  navButtonLeft: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  navButtonRight: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  navButtonFull: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 120,
  },
  navButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '600',
  },
  textInputContainer: {
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  refreshButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    backgroundColor: '#E9ECEF',
  },
  refreshButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 5,
  },
  workspaceTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 10,
  },
  entryCount: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    marginLeft: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginBottom: 10,
  },
  errorSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  homeButtonContainer: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 1000,
    backgroundColor: '#89CFF0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    marginLeft: 8,
    fontWeight: '600',
  },
  tempPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  tempPinImage: {
    width: 24,
    height: 24,
  },
  taskPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  taskPinImage: {
    width: 24,
    height: 24,
  },
  zoomContainer: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  searchContainer: {
    position: 'absolute',
    top: 65,
    left: 70,
    right: 20,
    zIndex: 1000,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 10,
    padding: 2,
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    maxHeight: 250,
  },
  searchResultsList: {
    paddingVertical: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  searchResultText: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  taskBottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taskSheetHeader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  taskSheetIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 12,
  },
  taskSheetTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
    fontWeight: '600',
  },
  taskIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  taskIcon: {
    width: 64,
    height: 64,
  },
  taskContentContainer: {
    marginBottom: 24,
  },
  taskInstructionText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  taskHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  taskHintText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#6B7280',
    marginLeft: 8,
  },
  taskButtonsContainer: {
    gap: 12,
  },
  taskSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  taskSubmitButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  taskCancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  taskCancelButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#9CA3AF',
  },
  taskFormModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  taskFormModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taskFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskFormIndicator: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  taskFormTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  taskFormCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  taskFormContent: {
    padding: 24,
    paddingTop: 16,
  },
  welcomeQuestionContainer: {
    marginBottom: 24,
  },
  welcomeQuestionLabel: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
    marginBottom: 12,
    fontWeight: '600',
  },
  welcomeTextInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
    minHeight: 56,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  welcomePickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  welcomePicker: {
    height: 56,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
