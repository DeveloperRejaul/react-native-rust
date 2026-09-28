/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useCallback, useEffect, useState } from 'react';
import {
  annotateObject,
  calculateAsync,
  greet,
  inspectWithCallback,
  isPositive,
  multiply,
  scaleValues,
} from 'rust-app-native-module';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const profile = { name: 'Ada Lovelace', score: 92, active: true, role: 'engineer' };
  const values = [1, 2, 3];
  const [promiseResult, setPromiseResult] = useState('Pending');
  const [callbackResult, setCallbackResult] = useState('Pending');
  const runAsyncExamples = useCallback(() => {
    setPromiseResult('Running');
    calculateAsync(21)
      .then((value) => setPromiseResult(String(value)))
      .catch((error: unknown) => setPromiseResult(error instanceof Error ? error.message : String(error)));

    setCallbackResult('Running');
    inspectWithCallback(profile, (label, score, active, details) => {
      setCallbackResult(JSON.stringify({ label, score, active, details }));
    });
  }, []);

  useEffect(() => {
    runAsyncExamples();
  }, [runAsyncExamples]);

  const rows = [
    { type: 'NUMBER', call: 'multiply(6, 7)', result: String(multiply(6, 7)) },
    { type: 'BOOLEAN', call: 'isPositive(-3)', result: String(isPositive(-3)) },
    { type: 'STRING', call: "greet('Ada')", result: greet('Ada') },
    { type: 'ARRAY', call: 'scaleValues([1, 2, 3])', result: JSON.stringify(scaleValues(values)) },
    { type: 'OBJECT', call: 'annotateObject(profile)', result: JSON.stringify(annotateObject(profile)) },
    { type: 'PROMISE', call: 'calculateAsync(21)', result: promiseResult },
    { type: 'CALLBACK', call: 'inspectWithCallback(profile, fn)', result: callbackResult },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: safeAreaInsets.top + 24 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>APP-LOCAL RUST</Text>
        <Text style={styles.title}>TurboModule types</Text>
        <Text style={styles.caption}>Live values returned by Rust handlers</Text>
        <Pressable accessibilityRole="button" onPress={runAsyncExamples} style={styles.button}>
          <Text style={styles.buttonText}>Run async examples again</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {rows.map((row, index) => (
          <View key={row.type} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.type}>{row.type}</Text>
              <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={styles.call}>{row.call}</Text>
            <Text selectable style={styles.result}>{row.result}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F5F0',
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  eyebrow: {
    color: '#387254',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    marginTop: 10,
    color: '#183A2A',
    fontSize: 28,
    fontWeight: '800',
  },
  caption: {
    marginTop: 5,
    color: '#66736A',
    fontSize: 14,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: '#C8E98A',
  },
  buttonText: {
    color: '#183A2A',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#DFE5DC',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    color: '#387254',
    fontSize: 10,
    fontWeight: '800',
  },
  index: {
    color: '#98A49A',
    fontSize: 10,
  },
  call: {
    marginTop: 5,
    color: '#26372C',
    fontSize: 13,
    fontWeight: '600',
  },
  result: {
    marginTop: 4,
    color: '#68746B',
    fontSize: 12,
  },
});

export default App;
