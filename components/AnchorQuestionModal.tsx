import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import TypoDetectingTextInput from './TypoDetectingTextInput';

interface AnchorQuestionModalProps {
  visible: boolean;
  workspaceName: string;
  anchorQuestion: string;
  mainDataType?: string;
  onAnswer: (answer: string) => void;
  onClose: () => void;
}

export default function AnchorQuestionModal({
  visible,
  workspaceName,
  anchorQuestion,
  mainDataType,
  onAnswer,
  onClose,
}: AnchorQuestionModalProps) {
  const [answer, setAnswer] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  console.log('[DEBUG] AnchorQuestionModal: visible=', visible, 'workspaceName=', workspaceName, 'anchorQuestion=', anchorQuestion, 'mainDataType=', mainDataType);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
  });

  React.useEffect(() => {
    if (visible) {
      setAnswer('');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSubmit = () => {
    console.log('[DEBUG] AnchorQuestionModal: handleSubmit called');
    if (!answer.trim()) {
      console.log('[DEBUG] AnchorQuestionModal: Empty answer, showing alert');
      Alert.alert('Missing Answer', 'Please provide an answer to continue.');
      return;
    }
    console.log('[DEBUG] AnchorQuestionModal: Calling onAnswer with:', answer.trim());
    onAnswer(answer.trim());
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <Ionicons name="help-circle-outline" size={32} color="#4A90E2" />
            </View>
            <Text style={styles.title}>Welcome to {workspaceName}</Text>
            <Text style={styles.subtitle}>Help us match you with the right tasks</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.questionContainer}>
              <Text style={styles.questionLabel}>Main Question</Text>
              <Text style={styles.questionText}>{anchorQuestion}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Answer</Text>
              <TypoDetectingTextInput
                style={styles.textInput}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type your answer here..."
                multiline
                numberOfLines={4}
                mainDataType={mainDataType}
              />

            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Skip for Now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
                <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Answer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    gap: 20,
  },
  questionContainer: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  questionLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#1F2937',
    lineHeight: 24,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1F2937',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#6B7280',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#6B7280',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
