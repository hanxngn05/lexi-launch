import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TypoDetectingTextInput from './TypoDetectingTextInput';

export type TaskQuestion = {
  text: string;
  type: 'text' | 'image' | 'audio';
};

type TasksFormProps = {
  questions: TaskQuestion[];
  initialAnswers?: string[];
  onSubmit: (answers: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
};

export default function TasksForm({ questions, initialAnswers = [], onSubmit, onCancel, loading }: TasksFormProps) {
  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [isMapRecording, setIsMapRecording] = useState(false);
  const [mapRecording, setMapRecording] = useState<Audio.Recording | null>(null);
  const filteredQuestions = questions.filter(q => q.text !== 'Which general area on campus are you reporting from?');
  const [step, setStep] = useState(0);

  const handleImagePick = async (idx: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant media library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newAnswers = [...answers];
      newAnswers[idx] = result.assets[0].uri;
      setAnswers(newAnswers);
    }
  };

  const handleAudioRecord = async (idx: number) => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setMapRecording(recording);
      setIsMapRecording(true);
      // You may want to handle stopping and saving the recording, then set the URI in answers[idx]
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleNext = () => {
    if (step < filteredQuestions.length - 1) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <View style={styles.formContainer}>
      {/* Progress Bar */}
      {filteredQuestions.length > 1 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressFill, { width: `${((step + 1) / filteredQuestions.length) * 100}%` }]} />
        </View>
      )}
      {/* Question Card */}
      {filteredQuestions.length > 0 && (
        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Question {step + 1}</Text>
          </View>
          <Text style={styles.inputLabel}>{filteredQuestions[step].text}</Text>
          {filteredQuestions[step].type === 'text' ? (
            <TypoDetectingTextInput
              value={answers[step] || ''}
              onChangeText={(val: string) => {
                const newAnswers = [...answers];
                newAnswers[step] = val;
                setAnswers(newAnswers);
              }}
              placeholder="Type your answer..."
              style={styles.questionInput}
              multiline
            />
          ) : filteredQuestions[step].type === 'image' ? (
            <TouchableOpacity onPress={() => handleImagePick(step)} style={styles.imageInput}>
              {answers[step] ? (
                <Image source={{ uri: answers[step] }} style={{ width: 100, height: 100, borderRadius: 8 }} />
              ) : (
                <Text style={{ color: '#888' }}>Tap to select image</Text>
              )}
            </TouchableOpacity>
          ) : filteredQuestions[step].type === 'audio' ? (
            <TouchableOpacity onPress={() => handleAudioRecord(step)} style={styles.audioInput}>
              <Text style={{ color: '#888' }}>{answers[step] ? 'Audio Recorded' : 'Tap to record audio'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {/* Navigation Buttons */}
      {filteredQuestions.length > 1 && (
        <View style={styles.bottomNav}>
          {step > 0 && (
            <TouchableOpacity style={styles.navButtonLeft} onPress={handleBack}>
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < filteredQuestions.length - 1 ? (
            <TouchableOpacity style={styles.navButtonRight} onPress={handleNext}>
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => onSubmit(answers)}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>{loading ? 'Submitting...' : 'Submit'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {/* Single question submit/cancel */}
      {filteredQuestions.length === 1 && (
        <>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => onSubmit(answers)}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>{loading ? 'Submitting...' : 'Submit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={onCancel}>
            <Text style={{ color: '#888' }}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
      {filteredQuestions.length > 1 && (
        <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={onCancel}>
          <Text style={{ color: '#888' }}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flex: 1,
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
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  questionInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  imageInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  audioInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    padding: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#EAEAEA',
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    alignItems: 'center',
  },
  navButtonLeft: {
    flex: 1,
    backgroundColor: '#EAEAEA',
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginRight: 8,
  },
  navButtonRight: {
    flex: 1,
    backgroundColor: '#4A90E2',
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginLeft: 8,
  },
  navButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
