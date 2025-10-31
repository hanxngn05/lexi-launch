// import TasksForm from '@/components/TasksForm';
import { AREA_COORDINATES } from '@/constants/areaCoordinates';
import { useAuth } from '@/context/auth';
import { api } from '@/utils/api';
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
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
  Keyboard,
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
  TouchableWithoutFeedback,
  View
} from 'react-native';
import MapView, { MapPressEvent, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Lexi form constants (mirror server expectations)
const LEXI_AREAS_LIST = [
  "The Quint (Beebe, Cazenove, Pomeroy, Shafer, Munger)",
  "East Side (Bates, Freeman, McAfee)",
  "Stone Davis",
  "Tower Court (East, West, Claflin, Severance)",
  "Academic Quad (Green, Founders, PNE/PNW, Jewett)",
  "Science Center",
  "Modular Units",
  "Lulu Chow Wang Campus Center",
  "Keohane Sports Center (KSC)",
  "Acorns",
  "Billings",
  "Harambee House",
  "Slater House",
  "Lake House",
  "On the Local Motion (‘What time do you take the bus?’)",
  "Bus stops (Chapel, Lulu, Founders)",
  "Shakespeare Houses",
  "TZE House",
  "ZA House",
  "French House",
  "Casa Cervantes",
  "Other",
];

const DETERMINATION_OPTIONS = [
  "I am a speaker of this language",
  "I’ve heard this language online or in media (movies, TV, music, etc.)",
  "My family speaks this language",
  "I’m currently learning this language",
  "My friends use this language",
  "I know a language in the same family (eg. romance)",
  "Other",
];

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
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  // Simplified: no onboarding/join flow in Lexi-only mode
  const [isMapRecording, setIsMapRecording] = useState(false);

  const { user, setUser, signOut } = useAuth();

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
  const [saving, setSaving] = useState(false);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');

  // Removed legacy question answers state

  // Add state for pin question answers
  const [pinQuestionAnswers, setPinQuestionAnswers] = useState<string[]>([]);

  // Lexi simplified form state (maps to server columns)
  const [generalArea, setGeneralArea] = useState<string>('');
  const [specificLocation, setSpecificLocation] = useState<string>('');
  const [languageSpoken, setLanguageSpoken] = useState<string>('');
  const [numSpeakers, setNumSpeakers] = useState<string>('1');
  const [wasPart, setWasPart] = useState<boolean | null>(null);
  const [goUpToSpeakers, setGoUpToSpeakers] = useState<'Yes' | 'No' | "I don't know" | null>(null);
  const [comfortableToAskMore, setComfortableToAskMore] = useState<'Yes' | 'No' | null>(null);
  const [followupDetails, setFollowupDetails] = useState<string>('');
  // Removed optional comfort-to-ask-more question per requirements
  const [determinationMethods, setDeterminationMethods] = useState<string[]>([]);
  const [determinationOtherText, setDeterminationOtherText] = useState<string>('');
  // Required field errors
  const [generalAreaErr, setGeneralAreaErr] = useState(false);
  const [specificErr, setSpecificErr] = useState(false);
  const [languageErr, setLanguageErr] = useState(false);
  const [numErr, setNumErr] = useState(false);
  const [wasPartErr, setWasPartErr] = useState(false);
  const [determinationErr, setDeterminationErr] = useState(false);
  const [areaSelectVisible, setAreaSelectVisible] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  // Optional follow-up modal
  const [optionalVisible, setOptionalVisible] = useState(false);
  const [optAudioUri, setOptAudioUri] = useState<string | null>(null);
  const [optOrigin, setOptOrigin] = useState('');
  const [optCultural, setOptCultural] = useState('');
  const [optDialect, setOptDialect] = useState('');
  const [optContext, setOptContext] = useState('');
  const [optProficiency, setOptProficiency] = useState('');
  const [optGender, setOptGender] = useState<'Female' | 'Male' | 'Transgender' | 'Non-binary / Gender nonconforming' | 'Prefer not to say' | 'Other' | null>(null);
  const [optGenderOther, setOptGenderOther] = useState('');
  const [optAcademic, setOptAcademic] = useState<'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Davis Scholar' | 'Faculty/Staff' | 'Pre-college' | 'Non Wellesley-affiliated adult' | null>(null);
  const [optComments, setOptComments] = useState('');
  const [optOutstanding, setOptOutstanding] = useState('');

  useEffect(() => {
    if (areaSelectVisible) setAreaSearch('');
  }, [areaSelectVisible]);

  // Add state for active task and bottom sheet/modal
  // const [activeTask, setActiveTask] = useState<any>(null);
  // const [showTaskSheet, setShowTaskSheet] = useState(false);
  // const [taskPin, setTaskPin] = useState<{ latitude: number; longitude: number } | null>(null);

  // Add state for form modal and answers
  const [showFormModal, setShowFormModal] = useState(false);
  const [formAnswers, setFormAnswers] = useState<string[]>([]);

  // Add state for search functionality
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAreas, setFilteredAreas] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoType, setInfoType] = useState<'intro' | 'submissions' | 'consent' | null>(null);
  const [isPlacingPin, setIsPlacingPin] = useState(false);

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
    // Task allocation disabled in simplified mode
  }, [areaParam, mapReady, taskParam]);

  const loadInitialData = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      // In Lexi-only mode, use a static set of questions for the form UI if needed
      const staticWorkspaceInfo = initialWorkspaceStructure(String(id), user);

      // Fetch responses from simplified endpoint
      const responsesData = await api.listLexiResponses();

      setWorkspaceInfo(staticWorkspaceInfo);

      // Transform database responses to marker format
      const transformedMarkers = (responsesData.responses || []).map((response: any) => ({
        id: response.id,
        timestamp: response.created_at,
        coordinates: {
          latitude: response.latitude ? parseFloat(response.latitude) : null,
          longitude: response.longitude ? parseFloat(response.longitude) : null,
        },
        // Map simplified answer fields if you show them in UI (optional)
        answers: [
          response.language_spoken || '',
        ],
        user_id: response.user_id,
      }));

      const validMarkers = transformedMarkers.filter((m: any) =>
        m.coordinates && typeof m.coordinates.latitude === 'number' && typeof m.coordinates.longitude === 'number' &&
        !isNaN(m.coordinates.latitude) && !isNaN(m.coordinates.longitude)
      );

      setMarkers(validMarkers);

    } catch (error) {
      console.error('Error loading workspace data:', error);
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  };

  const refreshMapData = async () => {
    if (!id || !user) return;
    setRefreshing(true);
    try {
      const responsesData = await api.listLexiResponses();
      const transformedMarkers = (responsesData.responses || []).map((response: any) => ({
        id: response.id,
        timestamp: response.created_at,
        coordinates: {
          latitude: response.latitude ? parseFloat(response.latitude) : null,
          longitude: response.longitude ? parseFloat(response.longitude) : null,
        },
        answers: [response.language_spoken || ''],
        user_id: response.user_id,
      }));
      const validMarkers = transformedMarkers.filter((m: any) =>
        m.coordinates && typeof m.coordinates.latitude === 'number' && typeof m.coordinates.longitude === 'number' &&
        !isNaN(m.coordinates.latitude) && !isNaN(m.coordinates.longitude)
      );
      setMarkers(validMarkers);
    } catch (error) {
      console.error('Error refreshing map data:', error);
      Alert.alert('Error', 'Could not refresh map data.');
    } finally {
      setRefreshing(false);
    }
  };

  // Removed legacy effect for question answers

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
    if (modalVisible) {
      setPinQuestionAnswers([]);
      setGeneralArea('');
      setSpecificLocation('');
      setLanguageSpoken('');
      setNumSpeakers('1');
      setWasPart(null);
      setGoUpToSpeakers(null);
      setComfortableToAskMore(null);
      setFollowupDetails('');

      setDeterminationMethods([]);
      setDeterminationOtherText('');
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

  // Removed legacy handler for question answers

  // Legacy join handler removed in Lexi-only mode

  const handleBackToHome = () => {
    router.replace(`/workspace/${id}`);
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (didSelectPinRef.current) {
      didSelectPinRef.current = false;
      return;
    }
    // Task allocation disabled
    // Only open form when user has armed pin placement via Lexi button
    if (!isPlacingPin) return;
    const { coordinate } = event.nativeEvent;
    setNewMarkerCoords(coordinate);
    setModalVisible(true);
    setIsPlacingPin(false);
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
    if (saving) return;
    if (!newMarkerCoords) {
      Alert.alert('Missing Information', 'Please select a location on the map.');
      return;
    }

    // Validate required fields
    const parsedNum = parseInt(numSpeakers, 10);
    // Validate requireds
    const gErr = !generalArea;
    const sErr = !specificLocation.trim();
    const lErr = !languageSpoken.trim();
    const nErr = isNaN(parsedNum);
    const wErr = wasPart === null;
    const dErr = determinationMethods.length === 0;
    setGeneralAreaErr(gErr);
    setSpecificErr(sErr);
    setLanguageErr(lErr);
    setNumErr(nErr);
    setWasPartErr(wErr);
    setDeterminationErr(dErr);
    if (gErr || sErr || lErr || nErr || wErr || dErr) {
      Alert.alert('Required fields missing', 'Please answer all required questions (marked with *).');
      try { scrollRef.current?.scrollTo({ y: 0, animated: true }); } catch {}
      return;
    }

    const payload: any = {
      user_id: String(user?.id || ''),
      general_area: generalArea,
      specific_location: specificLocation,
      language_spoken: languageSpoken,
      num_speakers: parsedNum,
      was_part_of_conversation: Boolean(wasPart),
      followup_details: followupDetails || undefined,
      comfortable_to_ask_more: comfortableToAskMore || undefined,
      go_up_to_speakers: wasPart === false ? (goUpToSpeakers || undefined) : undefined,
      // Extended optional fields appended in save function based on user choice
      determination_methods: determinationMethods,
      determination_other_text: determinationOtherText || undefined,
      latitude: newMarkerCoords.latitude,
      longitude: newMarkerCoords.longitude,
    };

    if (comfortableToAskMore === 'Yes') {
      payload.speaker_origin = optOrigin || undefined;
      payload.speaker_cultural_background = optCultural || undefined;
      payload.speaker_dialect = optDialect || undefined;
      payload.speaker_context = optContext || undefined;
      payload.speaker_proficiency = optProficiency || undefined;
      payload.speaker_gender_identity = optGender || undefined;
      payload.speaker_gender_other_text = optGender === 'Other' ? (optGenderOther || undefined) : undefined;
      payload.speaker_academic_level = optAcademic || undefined;
      payload.additional_comments = optComments || undefined;
      payload.outstanding_questions = optOutstanding || undefined;
    }

    try {
      setSaving(true);
      const res = await api.createLexiResponse(payload as any);
      if (!res?.success) throw new Error('Server rejected');
      await refreshMapData();
      setModalVisible(false);
      resetMapForm();
      setSelectedPin(null);
      Alert.alert('Saved', 'Your submission has been saved.');
    } catch (e) {
      Alert.alert('Save Failed', 'Could not save to the database.');
    } finally {
      setSaving(false);
    }
  };

  // Remove legacy dynamic questions in simplified mode

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
  // const openTaskSheet = (task: any) => {
  //   setActiveTask(task);
  //   setShowTaskSheet(true);
  //   setTaskPin(null);
  //   if (task && task.Which_general_area_on_campus_are_you_reporting_from) {
  //     zoomToArea(task.Which_general_area_on_campus_are_you_reporting_from);
  //   }
  // };

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
  // const handleTaskMapPress = (event: MapPressEvent) => {
  //   if (showTaskSheet) {
  //     setTaskPin(event.nativeEvent.coordinate);
  //     setShowFormModal(true); // Open the form immediately after pin
  //   } else {
  //     handleMapPress(event);
  //   }
  // };

  // On form submit
  // const handleSubmitTaskForm = async (answersFromForm?: string[]) => {
  //   if (!activeTask || !taskPin || !workspaceInfo?.questions) return;
  //   const payload = {
  //     answers: answersFromForm || formAnswers,
  //     latitude: taskPin.latitude,
  //     longitude: taskPin.longitude,
  //   };
  //   await makeRequest(`/tasks/${id}/${activeTask.id || activeTask.task_id}/complete`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(payload),
  //   });
  //   setShowFormModal(false);
  //   setShowTaskSheet(false);
  //   setActiveTask(null);
  //   setTaskPin(null);
  //   setFormAnswers([]);
  // };

  // Submit handler for completing the task
  // const handleSubmitTaskPin = async () => {
  //   if (!activeTask || !taskPin) return;
  //   try {
  //     await makeRequest(`/tasks/${id}/${activeTask.id || activeTask.task_id}/complete`, { method: 'POST' });
  //     setShowTaskSheet(false);
  //     setActiveTask(null);
  //     setTaskPin(null);
  //   } catch (e) {
  //     Alert.alert('Error', 'Failed to submit your location.');
  //   }
  // };

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
      {/* Search + Account overlay */}
      <View style={styles.searchContainer} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.accountButton}
            onPress={() => setAccountVisible(true)}
          >
            <Ionicons name="person-circle-outline" size={28} color="#4A90E2" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshTopButton}
          onPress={refreshMapData}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size={18} color="#4A90E2" />
          ) : (
            <Ionicons name="refresh" size={22} color="#4A90E2" />
          )}
        </TouchableOpacity>
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
        </View>

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
        onPress={handleMapPress}
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
                      styles.mapPulseBubble,
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
        {/* Task pin marker disabled in simplified mode */}
      </MapView>

      {/* Account & Campaign Modal */}
      <Modal
        visible={accountVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountVisible(false)}
      >
        <View style={styles.accountModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAccountVisible(false)}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          </TouchableWithoutFeedback>
          <View style={styles.accountSheet}>
            <Text style={styles.accountTitle}>Account & Campaign</Text>
            <View style={styles.bubbleColumn}>
              <TouchableOpacity style={styles.bubble} onPress={() => { setInfoType('intro'); setInfoVisible(true); }}>
                <Ionicons name="information-circle-outline" size={20} color="#1F2937" />
                <Text style={styles.bubbleText}>Introduction</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bubble} onPress={() => { setInfoType('submissions'); setInfoVisible(true); }}>
                <Ionicons name="document-text-outline" size={20} color="#1F2937" />
                <Text style={styles.bubbleText}>Your submissions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bubble} onPress={() => { setAccountVisible(false); router.push('/consent'); }}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#1F2937" />
                <Text style={styles.bubbleText}>Consent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bubble} onPress={() => { setAccountVisible(false); signOut(); }}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={[styles.bubbleText, { color: '#EF4444' }]}>Log out</Text>
              </TouchableOpacity>
            </View>

            {/* Full-screen info modals */}
            <Modal visible={infoVisible} transparent animationType="slide" onRequestClose={() => setInfoVisible(false)}>
              <View style={styles.infoOverlay}>
                <SafeAreaView style={styles.infoContainer}>
                  <View style={styles.infoHeader}>
                    <Text style={styles.infoTitle}>
                      {infoType === 'intro' ? 'Introduction' : infoType === 'submissions' ? 'Your submissions' : 'Info'}
                    </Text>
                    <TouchableOpacity onPress={() => setInfoVisible(false)} style={styles.infoCloseBtn}>
                      <Ionicons name="close" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={styles.infoContent} showsVerticalScrollIndicator={false}>
                    {infoType === 'submissions' && (
                      <View>
                        {(markers || []).filter((m: any) => m?.user_id === user?.id).length === 0 ? (
                          <Text style={styles.expandText}>No submissions yet.</Text>
                        ) : (
                          (markers || [])
                            .filter((m: any) => m?.user_id === user?.id)
                            .slice() // copy
                            .reverse() // latest first
                            .map((m: any, idx: number) => (
                              <View key={idx} style={styles.submissionItem}>
                                <Text style={styles.submissionTitle}>{new Date(m.timestamp).toLocaleString()}</Text>
                                {(workspaceInfo?.questions || []).map((q: any, qi: number) => (
                                  <Text key={`${idx}-${qi}`} style={styles.submissionText}>
                                    {q.text}: {m.answers?.[qi] || ''}
                                  </Text>
                                ))}
                              </View>
                            ))
                        )}
                      </View>
                    )}
                    {infoType === 'intro' && (
                      <View style={{ width: '100%' }}>
                        <View style={styles.introHeader}>
                          <Image source={require('../../assets/images/lexi_icon.png')} style={styles.introLogo} />
                          <View>
                            <Text style={styles.introTitle}>Hi there — I’m Lexi!</Text>
                            <Text style={styles.introSubtitle}>Thanks for helping map languages at Wellesley 💙</Text>
                          </View>
                        </View>

                        <View style={styles.introCard}>
                          <Text style={styles.introParagraph}>
                            Thank you so much for your interest in helping me understand language usage on Wellesley’s campus — I’m excited to learn from you.
                          </Text>
                          <Text style={styles.introParagraph}>
                            It’s important that responses are in good faith and strive to correctly represent the language groups that belong on campus. Let’s avoid misidentifying our community’s unique and valuable identities.
                          </Text>

                          <View style={styles.divider} />
                          <Text style={styles.introRulesTitle}>Lexi’s List of Rules</Text>

                          <View style={styles.bulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.bulletText}>Be kind. If you wouldn’t say it out loud, don’t hit send.</Text>
                          </View>
                          <View style={styles.bulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.bulletText}>Be honest. There’s no “right” answer — truthful beats made‑up data.</Text>
                          </View>
                          <View style={styles.bulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.bulletText}>Be brave. If you’re unsure, kindly ask the speaker — it’s a great chance to connect.</Text>
                          </View>
                          <View style={styles.bulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.bulletText}>Be enthusiastic. The more you engage, the more we can learn together!</Text>
                          </View>
                        </View>
                      </View>
                    )}
                    {/* consent handled on dedicated page */}
                  </ScrollView>
                </SafeAreaView>
              </View>
            </Modal>

            <TouchableOpacity style={styles.accountCloseButton} onPress={() => setAccountVisible(false)}>
              <Text style={styles.accountCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button: arm pin placement, then tap map to set location */}
      <View style={styles.bottomRightContainer}>
        <TouchableOpacity
          style={styles.formToggleButton}
          onPress={() => setIsPlacingPin((prev) => !prev)}
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
          </View>
          <Text style={styles.title}>Add a Lexi observation</Text>
          <Text style={styles.requiredNote}><Text style={styles.required}>*</Text> Required</Text>
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <Text style={styles.inputLabel}>In what general area on campus did you hear the language? <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              onPress={() => setAreaSelectVisible(true)}
              activeOpacity={0.8}
              style={[styles.selectField, (generalAreaErr ? { borderColor: '#EF4444' } : (!generalArea ? { borderColor: '#F59E0B' } : null))]}
            >
              <Text style={generalArea ? styles.selectFieldText : [styles.selectFieldText, { color: '#9CA3AF' }]}>
                {generalArea || 'Select general area'}
              </Text>
            </TouchableOpacity>
            {areaSelectVisible && (
              <View style={styles.dropdownPanel}>
                <TextInput
                  placeholder="Search areas..."
                  value={areaSearch}
                  onChangeText={setAreaSearch}
                  style={[styles.text, { backgroundColor: '#F9FAFB', borderWidth: 0, marginBottom: 8 }]}
                />
                <ScrollView style={{ maxHeight: 300 }}>
                  {LEXI_AREAS_LIST.filter(a => a.toLowerCase().includes(areaSearch.toLowerCase())).map(opt => {
                    const selected = generalArea === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        activeOpacity={0.7}
                        style={[styles.areaRow, selected && { backgroundColor: '#F0F7FF' }]}
                        onPress={() => { setGeneralArea(opt); setAreaSelectVisible(false); setAreaSearch(''); }}
                      >
                        <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                          {selected ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text style={styles.areaText}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={[styles.bottomNavFullWidth, { paddingTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.navButtonFull, { borderRadius: 999 }]}
                    onPress={() => { setAreaSelectVisible(false); setAreaSearch(''); }}
                  >
                    <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Where are you, exactly? <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.text}
              placeholder="e.g., Lulu fireplace, Leaky Beaker, outside in the Quint"
              value={specificLocation}
              onChangeText={(t) => { setSpecificLocation(t); if (specificErr && t.trim()) setSpecificErr(false);} }
            />
            {specificErr ? <Text style={styles.errorText}>This field is required.</Text> : null}

            <Text style={styles.inputLabel}>What language was spoken? <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.text}
              placeholder="e.g., Spanish"
              value={languageSpoken}
              onChangeText={(t) => { setLanguageSpoken(t); if (languageErr && t.trim()) setLanguageErr(false);} }
            />
            {languageErr ? <Text style={styles.errorText}>This field is required.</Text> : null}

            <Text style={styles.inputLabel}>How many speakers were present? <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.text}
              placeholder="e.g., 2"
              keyboardType="number-pad"
              value={numSpeakers}
              onChangeText={(t) => { const v = t.replace(/\D/g, ''); setNumSpeakers(v); if (numErr && v) setNumErr(false);} }
            />
            {numErr ? <Text style={styles.errorText}>Please enter a number.</Text> : null}

            <Text style={styles.inputLabel}>Were you part of the conversation? <Text style={styles.required}>*</Text></Text>
            <View style={styles.optionRow}>
              {['Yes','No'].map(val => (
                <TouchableOpacity
                  key={val}
                  style={[styles.optionPill, (wasPart === (val==='Yes')) && styles.optionPillActive]}
                  onPress={() => { setWasPart(val === 'Yes'); if (wasPartErr) setWasPartErr(false);} }
                >
                  <Text style={{ color: (wasPart === (val==='Yes')) ? '#fff' : '#1F2937', fontWeight: '600' }}>{val}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {wasPartErr ? <Text style={styles.errorText}>Please select Yes or No.</Text> : null}

            {wasPart === true && (
              <>
                <Text style={styles.inputLabel}>You indicated you were part of the conversation. Tell me more (optional)</Text>
                <TextInput
                  style={[styles.text, { minHeight: 80 }]}
                  placeholder="Add details..."
                  value={followupDetails}
                  onChangeText={setFollowupDetails}
                  multiline
                />
              </>
            )}

            {wasPart === false && (
              <>
                <Text style={styles.inputLabel}>Would you be comfortable going up to the person and asking them more questions?</Text>
                <View style={styles.optionRow}>
                  {(['Yes','No',"I don't know"] as const).map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.optionPill, (goUpToSpeakers === val) && styles.optionPillActive]}
                      onPress={() => setGoUpToSpeakers(val)}
                    >
                      <Text style={{ color: (goUpToSpeakers === val) ? '#fff' : '#1F2937', fontWeight: '600' }}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>How did you determine the language? (check all that apply) <Text style={styles.required}>*</Text></Text>
            {DETERMINATION_OPTIONS.map((opt) => {
              const checked = determinationMethods.includes(opt);
              return (
                <TouchableOpacity key={opt} style={styles.checkboxRow} onPress={() => {
                  setDeterminationMethods((prev) => checked ? prev.filter(x => x !== opt) : [...prev, opt]);
                }}>
                  <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
                    {checked ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxText}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {determinationMethods.includes('Other') && (
              <TextInput
                style={styles.text}
                placeholder="Please specify"
                value={determinationOtherText}
                onChangeText={setDeterminationOtherText}
              />
            )}
            {determinationErr ? <Text style={styles.errorText}>Select at least one option.</Text> : null}

            {/* Ask at end: do you want to answer more questions now? Controls optional form */}
            <Text style={styles.inputLabel}>Would you like to answer more questions now?</Text>
            <View style={styles.optionRow}>
              {([ 'Yes', 'No' ] as const).map(val => (
                <TouchableOpacity
                  key={val}
                  style={[styles.optionPill, (comfortableToAskMore === val) && styles.optionPillActive]}
                  onPress={() => setComfortableToAskMore(val)}
                >
                  <Text style={{ color: (comfortableToAskMore === val) ? '#fff' : '#1F2937', fontWeight: '600' }}>{val}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {comfortableToAskMore === 'Yes' && (
              <>
                <Text style={styles.inputLabel}>Where is the speaker from?</Text>
                <TextInput style={styles.text} value={optOrigin} onChangeText={setOptOrigin} placeholder="Geographic location" />

                <Text style={styles.inputLabel}>Cultural/ethnic background</Text>
                <TextInput style={styles.text} value={optCultural} onChangeText={setOptCultural} placeholder="Background" />

                <Text style={styles.inputLabel}>Dialect or accent</Text>
                <TextInput style={styles.text} value={optDialect} onChangeText={setOptDialect} placeholder="Dialect/accent" />

                <Text style={styles.inputLabel}>Context of language use</Text>
                <TextInput style={styles.text} value={optContext} onChangeText={setOptContext} placeholder="e.g., talking to family, friends, practicing for exam" />

                <Text style={styles.inputLabel}>Self-prescribed proficiency</Text>
                <TextInput style={styles.text} value={optProficiency} onChangeText={setOptProficiency} placeholder="Proficiency level" />

                <Text style={styles.inputLabel}>Gender identity</Text>
                <View style={styles.optionRow}>
                  {(['Female','Male','Transgender','Non-binary / Gender nonconforming','Prefer not to say','Other'] as const).map(val => (
                    <TouchableOpacity key={val} style={[styles.optionPill, optGender === val && styles.optionPillActive]} onPress={() => setOptGender(val)}>
                      <Text style={{ color: (optGender === val) ? '#fff' : '#1F2937', fontWeight: '600' }}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {optGender === 'Other' && (
                  <TextInput style={styles.text} value={optGenderOther} onChangeText={setOptGenderOther} placeholder="Please specify" />
                )}

                <Text style={styles.inputLabel}>Academic level</Text>
                <View style={styles.optionRow}>
                  {(['Freshman','Sophomore','Junior','Senior','Davis Scholar','Faculty/Staff','Pre-college','Non Wellesley-affiliated adult'] as const).map(val => (
                    <TouchableOpacity key={val} style={[styles.optionPill, optAcademic === val && styles.optionPillActive]} onPress={() => setOptAcademic(val)}>
                      <Text style={{ color: (optAcademic === val) ? '#fff' : '#1F2937', fontWeight: '600' }}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Additional comments/feedback</Text>
                <TextInput style={[styles.text, { minHeight: 80 }]} value={optComments} onChangeText={setOptComments} multiline placeholder="Optional" />

                <Text style={styles.inputLabel}>Outstanding questions about language at Wellesley</Text>
                <TextInput style={[styles.text, { minHeight: 80 }]} value={optOutstanding} onChangeText={setOptOutstanding} multiline placeholder="Optional" />
              </>
            )}

            <View style={[styles.bottomNavFullWidth, { paddingBottom: 30 }]}>
              <TouchableOpacity
                style={styles.navButtonFull}
                onPress={() => {
                  try { Keyboard.dismiss(); } catch {}
                  handleMapFormSubmit();
                }}
                disabled={false}
              >
                <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>{saving ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* General Area Selector Overlay (avoid nested modal issues) */}
      {/* Inline dropdown panel replaces overlay to ensure taps work in all environments */}

      {/* Optional questions modal removed; rendered inline when end question is Yes */}

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

      {/* Simplified: remove onboarding/join modal */}

      {/* Task bottom sheet/modal */}
      {/* Task bottom sheet disabled in simplified mode */}

      {/* Task form modal */}
      {/* Task form modal disabled in simplified mode */}
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
  mapPulseBubble: {
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
  accountModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountSheet: {
    width: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    alignSelf: 'center',
  },
  accountTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  bubbleColumn: {
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  bubbleText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
  },
  expandCard: {
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
  },
  expandTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  expandText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  introLogo: {
    width: 40,
    height: 40,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
  },
  introSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#6B7280',
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 8,
  },
  introParagraph: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
    lineHeight: 20,
  },
  introRulesTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
    marginTop: 2,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  areaOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  areaBackdrop: {
    ...StyleSheet.absoluteFillObject as any,
  },
  areaPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  infoContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
  },
  infoCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  infoContent: {
    padding: 16,
    gap: 10,
  },
  submissionItem: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  submissionTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  submissionText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
  },
  accountSectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  accountText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  accountCloseButton: {
    marginTop: 8,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  accountCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
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
  required: {
    color: '#2563EB',
  },
  requiredNote: {
    color: '#6B7280',
    fontSize: 12,
    marginLeft: 20,
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
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  optionPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxBoxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxText: {
    color: '#111827',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 8,
    fontSize: 12,
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
  refreshTopButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'absolute',
    right: 0,
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
  // taskPin: {
  //   width: 30,
  //   height: 30,
  //   borderRadius: 15,
  //   backgroundColor: '#FFFFFF',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.3,
  //   shadowRadius: 4,
  //   elevation: 3,
  //   borderWidth: 2,
  //   borderColor: '#4A90E2',
  // },
  // taskPinImage: {
  //   width: 24,
  //   height: 24,
  // },
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
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    width: '72%',
    marginLeft: 10,
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
  accountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'absolute',
    left: 0,
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
  // taskBottomSheet: {
  //   position: 'absolute',
  //   left: 0,
  //   right: 0,
  //   bottom: 0,
  //   backgroundColor: '#FFFFFF',
  //   borderTopLeftRadius: 24,
  //   borderTopRightRadius: 24,
  //   paddingHorizontal: 24,
  //   paddingBottom: 30,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: -4 },
  //   shadowOpacity: 0.15,
  //   shadowRadius: 8,
  //   elevation: 8,
  // },
  // taskSheetHeader: {
  //   alignItems: 'center',
  //   paddingVertical: 16,
  // },
  // taskSheetIndicator: {
  //   width: 40,
  //   height: 4,
  //   backgroundColor: '#E5E7EB',
  //   borderRadius: 2,
  //   marginBottom: 12,
  // },
  // taskSheetTitle: {
  //   fontSize: 20,
  //   fontFamily: 'Poppins_600SemiBold',
  //   color: '#1F2937',
  //   fontWeight: '600',
  // },
  // taskIconContainer: {
  //   alignItems: 'center',
  //   marginBottom: 20,
  // },
  // taskIcon: {
  //   width: 64,
  //   height: 64,
  // },
  // taskContentContainer: {
  //   marginBottom: 24,
  // },
  // taskInstructionText: {
  //   fontSize: 16,
  //   fontFamily: 'Poppins_400Regular',
  //   color: '#374151',
  //   textAlign: 'center',
  //   lineHeight: 24,
  //   marginBottom: 16,
  // },
  // taskHintContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   backgroundColor: '#F3F4F6',
  //   paddingVertical: 12,
  //   paddingHorizontal: 16,
  //   borderRadius: 12,
  // },
  // taskHintText: {
  //   fontSize: 14,
  //   fontFamily: 'Poppins_400Regular',
  //   color: '#6B7280',
  //   marginLeft: 8,
  // },
  // taskButtonsContainer: {
  //   gap: 12,
  // },
  // taskSubmitButton: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   backgroundColor: '#4A90E2',
  //   paddingVertical: 16,
  //   paddingHorizontal: 24,
  //   borderRadius: 12,
  //   shadowColor: '#4A90E2',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.3,
  //   shadowRadius: 8,
  //   elevation: 4,
  // },
  // taskSubmitButtonText: {
  //   fontSize: 16,
  //   fontFamily: 'Poppins_600SemiBold',
  //   color: '#FFFFFF',
  //   fontWeight: '600',
  //   marginLeft: 8,
  // },
  // taskCancelButton: {
  //   alignItems: 'center',
  //   paddingVertical: 12,
  // },
  // taskCancelButtonText: {
  //   fontSize: 14,
  //   fontFamily: 'Poppins_400Regular',
  //   color: '#9CA3AF',
  // },
  // taskFormModalOverlay: {
  //   flex: 1,
  //   backgroundColor: 'rgba(0, 0, 0, 0.4)',
  //   justifyContent: 'flex-end',
  // },
  // taskFormModalContainer: {
  //   backgroundColor: '#FFFFFF',
  //   borderTopLeftRadius: 24,
  //   borderTopRightRadius: 24,
  //   maxHeight: '90%',
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: -4 },
  //   shadowOpacity: 0.15,
  //   shadowRadius: 8,
  //   elevation: 8,
  // },
  // taskFormHeader: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   paddingHorizontal: 24,
  //   paddingTop: 16,
  //   paddingBottom: 8,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#F3F4F6',
  // },
  // taskFormIndicator: {
  //   position: 'absolute',
  //   top: 8,
  //   left: '50%',
  //   marginLeft: -20,
  //   width: 40,
  //   height: 4,
  //   backgroundColor: '#E5E7EB',
  //   borderRadius: 2,
  // },
  // taskFormTitle: {
  //   fontSize: 20,
  //   fontFamily: 'Poppins_600SemiBold',
  //   color: '#1F2937',
  //   fontWeight: '600',
  //   textAlign: 'center',
  //   flex: 1,
  // },
  // taskFormCloseButton: {
  //   padding: 8,
  //   borderRadius: 20,
  //   backgroundColor: '#F9FAFB',
  // },
  // taskFormContent: {
  //   padding: 24,
  //   paddingTop: 16,
  // },
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
  selectField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dropdownPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  selectFieldText: {
    fontSize: 16,
    color: '#111827',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  areaText: {
    fontSize: 15,
    color: '#111827',
    marginLeft: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
});
