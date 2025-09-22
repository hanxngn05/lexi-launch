import { useAuth } from '@/context/auth';
import { api } from '@/utils/api';
import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Question = {
  text: string;
  type: 'text' | 'image' | 'audio';
};

export default function WorkspaceForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mainQuestion, setMainQuestion] = useState('');
  const [anchorQuestion, setAnchorQuestion] = useState('');
  const [mainDataType, setMainDataType] = useState('');
  const [questions, setQuestions] = useState<Question[]>([{ text: '', type: 'text' }]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  React.useEffect(() => {
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
  }, []);

  const clearForm = () => {
    setName('');
    setDescription('');
    setMainQuestion('');
    setAnchorQuestion('');
    setMainDataType('');
    setQuestions([{ text: '', type: 'text' }]);
  };

  const handleClose = () => {
    Alert.alert(
      'Close Form',
      'Are you sure you want to close? All unsaved changes will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => {
            clearForm();
            router.back();
          },
        },
      ]
    );
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter a workspace name.');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please enter a workspace description.');
      return false;
    }
    if (!mainQuestion.trim()) {
      Alert.alert('Missing Information', 'Please enter a main question.');
      return false;
    }
    if (!anchorQuestion.trim()) {
      Alert.alert('Missing Information', 'Please enter a welcome question that users will see when joining this workspace.');
      return false;
    }
    if (!mainDataType.trim()) {
      Alert.alert('Missing Information', 'Please specify the main data type you\'re collecting (e.g., languages, food, weather, traffic, etc.).');
      return false;
    }

    // Check if all questions have text
    const emptyQuestions = questions.filter(q => !q.text.trim());
    if (emptyQuestions.length > 0) {
      Alert.alert(
        'Incomplete Questions',
        'Please fill in all question fields or remove empty questions.',
        [
          {
            text: 'Continue Editing',
            style: 'cancel',
          },
          {
            text: 'Remove Empty Questions',
            onPress: () => {
              const validQuestions = questions.filter(q => q.text.trim());
              setQuestions(validQuestions.length > 0 ? validQuestions : [{ text: '', type: 'text' }]);
            },
          },
        ]
      );
      return false;
    }

    return true;
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { text: '', type: 'text' }]);
  };

  const handleQuestionChange = (index: number, text: string) => {
    const newQuestions = [...questions];
    newQuestions[index].text = text;
    setQuestions(newQuestions);
  };

  const handleQuestionTypeChange = (index: number, type: 'text' | 'image' | 'audio') => {
    const newQuestions = [...questions];
    newQuestions[index].type = type;
    setQuestions(newQuestions);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    if (!user || !user.id) {
      Alert.alert('Authentication Error', 'You must be logged in to create a workspace.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    const workspaceData = {
      name: name.trim(),
      description: description.trim(),
      main_question: mainQuestion.trim(),
      anchor_question: anchorQuestion.trim(),
      main_data_type: mainDataType.trim(),
      questions: questions.filter(q => q.text.trim()),
      developer: user.id,
    };

    try {
      await api.createWorkspace(workspaceData);
      Alert.alert('Success', 'Workspace created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            clearForm();
            router.push('/developer-home');
          },
        },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to create workspace. Please try again.');
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="business-outline" size={32} color="#4A90E2" />
            </View>
            <Text style={styles.title}>Create Workspace</Text>
            <Text style={styles.subtitle}>Build a community for your campus</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="pricetag-outline" size={16} color="#4A90E2" />
                <Text style={styles.label}>Workspace Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Campus Journalism Club"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="document-text-outline" size={16} color="#4A90E2" />
                <Text style={styles.label}>Description</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="A brief description of the workspace"
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="analytics-outline" size={16} color="#4A90E2" />
                <Text style={styles.label}>Main Data Type</Text>
              </View>
              <TextInput
                style={styles.input}
                value={mainDataType}
                onChangeText={setMainDataType}
                placeholder="e.g., languages, food, weather, traffic, etc."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4A90E2" />
                <Text style={styles.label}>Welcome Question</Text>
              </View>
              <Text style={styles.helpText}>
                This question will be asked to users when they join your workspace to understand their preferences and capabilities.
              </Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={anchorQuestion}
                onChangeText={setAnchorQuestion}
                placeholder="e.g., What languages do you speak? What are your interests? What skills do you have?"
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={16} color="#4A90E2" />
              <Text style={styles.infoText}>
                The main data type helps AI understand what kind of data you're collecting for better suggestions. The welcome question helps match users to appropriate tasks based on their preferences.
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle-outline" size={20} color="#4A90E2" />
              <Text style={styles.sectionTitle}>Form Questions</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={16} color="#4A90E2" />
              <Text style={styles.infoText}>
                The first question, <Text style={styles.boldText}>'Which general area on campus are you reporting from?'</Text>, is mandatory and will always be included as a dropdown for all users.
              </Text>
            </View>

            {/* Main Question - moved under Form Questions */}
            <View style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <View style={styles.questionNumberContainer}>
                  <View style={styles.questionNumberBadge}>
                    <Text style={styles.questionNumberText}>M</Text>
                  </View>
                  <Text style={styles.questionNumberLabel}>Main Question</Text>
                </View>
              </View>
              <Text style={styles.helpText}>
                This is the main information you want to collect. It will appear in task forms and map pins.
              </Text>
              <TextInput
                style={styles.questionInput}
                value={mainQuestion}
                onChangeText={setMainQuestion}
                placeholder="e.g., What languages do you speak? What is your main concern?"
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            {questions.map((q, index) => (
              <View key={index} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <View style={styles.questionNumberContainer}>
                    <View style={styles.questionNumberBadge}>
                      <Text style={styles.questionNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.questionNumberLabel}>Question {index + 1}</Text>
                  </View>
                  {questions.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveQuestion(index)}
                      style={styles.removeQuestionButton}
                    >
                      <Ionicons name="trash-outline" size={16} color="#F44336" />
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.questionInput}
                  value={q.text}
                  onChangeText={(text) => handleQuestionChange(index, text)}
                  placeholder="What would you like to ask new members?"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />

                <View style={styles.questionTypeSection}>
                  <Text style={styles.questionTypeLabel}>Response type:</Text>
                  <View style={styles.questionTypeContainer}>
                    {(['text', 'image', 'audio'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.questionTypeButton,
                          q.type === type && styles.questionTypeButtonSelected,
                        ]}
                        onPress={() => handleQuestionTypeChange(index, type)}
                      >
                        <Ionicons
                          name={
                            type === 'text' ? 'text-outline' :
                            type === 'image' ? 'image-outline' : 'mic-outline'
                          }
                          size={16}
                          color={q.type === type ? '#4A90E2' : '#666'}
                        />
                        <Text
                          style={[
                            styles.questionTypeButtonText,
                            q.type === type && styles.questionTypeButtonTextSelected,
                          ]}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>


              </View>
            ))}

            <TouchableOpacity onPress={handleAddQuestion} style={styles.addQuestionButton}>
              <Ionicons name="add-circle-outline" size={20} color="#4A90E2" />
              <Text style={styles.addQuestionText}>Add Another Question</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
              <Ionicons name="rocket-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Create Workspace</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
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
    backgroundColor: '#E6F2FF',
    top: 200,
    left: '50%',
    transform: [{ translateX: -75 }],
    opacity: 0.3,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 100,
    paddingBottom: 50,
  },
  headerContainer: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    // padding: 24, // This is now handled by content style
    // paddingTop: 100, // This is now handled by content style
    // paddingBottom: 50, // This is now handled by content style
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#E6F2FF',
    borderRadius: 20,
    padding: 15,
    marginTop: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCE5FF',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#333',
    marginLeft: 10,
  },
  boldText: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    padding: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  questionNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  questionNumberLabel: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
  },
  removeQuestionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  questionTypeSection: {
    marginTop: 10,
  },
  questionTypeLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  questionTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  questionTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#EAEAEA',
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  questionTypeButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E6F2FF',
  },
  questionTypeButtonText: {
    color: '#333',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    marginLeft: 8,
  },
  questionTypeButtonTextSelected: {
    color: '#4A90E2',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  addQuestionButton: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
  addQuestionIcon: {
    color: '#4A90E2',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  addQuestionText: {
    color: '#4A90E2',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  questionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  selectedQuestion: {
    borderColor: '#4A90E2',
    backgroundColor: '#F0F9FF',
  },
  questionOptionText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#374151',
    flex: 1,
  },
  mainQuestionSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
  },
  mainQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EAEAEA',
    backgroundColor: 'transparent',
    gap: 8,
  },
  mainQuestionButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E6F2FF',
  },
  mainQuestionButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#666',
  },
  mainQuestionButtonTextSelected: {
    color: '#4A90E2',
  },
  mainQuestionHelpText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
