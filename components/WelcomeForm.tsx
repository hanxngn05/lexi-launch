import { api } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface WelcomeFormProps {
  visible: boolean;
  workspace: any;
  onContinue: (answer?: string) => void;
  onClose: () => void;
}

export default function WelcomeForm({ visible, workspace, onContinue, onClose }: WelcomeFormProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [developerName, setDeveloperName] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');

  useEffect(() => {
    if (visible) setCurrentSlide(0);
  }, [visible]);

  useEffect(() => {
    async function resolveDeveloperName() {
      if (workspace?.developerName) {
        setDeveloperName(workspace.developerName);
      } else if (workspace?.developer && workspace.developer.name) {
        setDeveloperName(workspace.developer.name);
      } else if (workspace?.developer && typeof workspace.developer === 'string') {
        // Fetch developer name by ID
        try {
          const dev = await api.getUserById(workspace.developer);
          setDeveloperName(dev?.name || 'Unknown Developer');
        } catch {
          setDeveloperName('Unknown Developer');
        }
      } else {
        setDeveloperName('Unknown Developer');
      }
    }
    resolveDeveloperName();
  }, [workspace]);

  const handleContinue = () => {
    if (currentSlide < 2) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onContinue(questionAnswer);
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          {/* Workspace Icon/Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="business" size={32} color="#fff" />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {currentSlide === 0 && (
              <View>
                <Text style={styles.title}>Welcome to {workspace?.name || 'Workspace'}</Text>
                <Text style={styles.subtitle}>Created by {developerName}</Text>
                <Text style={styles.description}>{workspace?.description || 'No description available'}</Text>
              </View>
            )}
            {currentSlide === 1 && (
              <View>
                <Text style={styles.slideTitle}>How to Use This Workspace</Text>
                <View style={styles.instructionsCard}>
                  <Text style={styles.bullet}>• Tap on the map to add your observations</Text>
                  <Text style={styles.bullet}>• Fill out forms to share your experiences</Text>
                  <Text style={styles.bullet}>• Each workspace has its own specific questions</Text>
                  <Text style={styles.bullet}>• Your responses help improve this workspace</Text>
                </View>
                <Text style={styles.privacy}>
                  <Ionicons name="shield-checkmark" size={18} color="#059669" />{'  '}
                  Your personal information is kept private and secure. Location data is anonymized and used only to improve campus services.
                </Text>
              </View>
            )}
            {currentSlide === 2 && (
              <View>
                <Text style={styles.slideTitle}>Welcome Question</Text>
                <Text style={styles.question}>{workspace?.anchorQuestion || 'Briefly share your "language story" for languages you know or speak. In 1–2 sentences (or more, if you wish), tell us how you learned the language, how you use it, what it means to you, or anything else you’d like to share.'}</Text>
                <TextInput
                  style={styles.input}
                  value={questionAnswer}
                  onChangeText={setQuestionAnswer}
                  placeholder="Type your answer here..."
                  multiline
                />

              </View>
            )}
          </ScrollView>
          <View style={styles.divider} />
          <View style={styles.buttonRow}>
            {currentSlide > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={18} color="#6B7280" />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>{currentSlide < 2 ? 'Continue' : 'Join Workspace'}</Text>
              <Ionicons name={currentSlide < 2 ? 'arrow-forward' : 'checkmark'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 0,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 220,
    width: '100%',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
    color: '#2563eb',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 8,
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1e293b',
  },
  instructionsCard: {
    backgroundColor: '#f1f5fd',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    width: '100%',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  bullet: {
    fontSize: 16,
    marginBottom: 4,
    color: '#1e293b',
  },
  privacy: {
    fontSize: 15,
    color: '#059669',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
    backgroundColor: '#e6f9f0',
    borderRadius: 10,
    padding: 10,
  },
  question: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    color: '#1e293b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 14,
    minHeight: 80,
    marginTop: 10,
    marginBottom: 10,
    width: 320,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: '#f8fafc',
  },
  tip: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 8,
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  backText: {
    color: '#6B7280',
    fontSize: 16,
    marginLeft: 6,
    fontWeight: 'bold',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    marginRight: 6,
    fontWeight: 'bold',
  },
});
