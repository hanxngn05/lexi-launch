import WorkspaceForm from '@/components/WorkspaceForm';
import { StyleSheet, View } from 'react-native';

export default function CreateWorkspaceScreen() {
  return (
    <View style={styles.container}>
      <WorkspaceForm />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
