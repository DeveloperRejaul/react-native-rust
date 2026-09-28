import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  annotateObject,
  calculateAsync,
  greet,
  initRustWeb,
  inspectWithCallback,
  isPositive,
  multiply,
  scaleValues,
  subtract,
} from 'react-native-awesome-library';

export default function App() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [promiseResult, setPromiseResult] = useState('Waiting');
  const [callbackResult, setCallbackResult] = useState('Waiting');

  const runExamples = useCallback(async () => {
    await initRustWeb();
    const profile = { name: 'Ada Lovelace', score: 92, active: true, role: 'engineer' };
    setResults({
      multiply: String(multiply(3, 7)),
      subtract: String(subtract(10, 4)),
      boolean: String(isPositive(-4)),
      string: greet('Ada'),
      array: JSON.stringify(scaleValues([1, 2, 3])),
      object: JSON.stringify(annotateObject(profile)),
    });

    setCallbackResult('Running');
    inspectWithCallback(profile, (label, score, active, details) => {
      setCallbackResult(JSON.stringify({ label, score, active, details }));
    });

    setPromiseResult('Running');
    calculateAsync(21)
      .then((value) => setPromiseResult(String(value)))
      .catch((error: unknown) => setPromiseResult(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    runExamples();
  }, [runExamples]);

  const rows = [
    { label: 'NUMBER', call: 'multiply(3, 7)', result: results.multiply ?? 'Waiting' },
    { label: 'NUMBER', call: 'subtract(10, 4)', result: results.subtract ?? 'Waiting' },
    { label: 'BOOLEAN', call: 'isPositive(-4)', result: results.boolean ?? 'Waiting' },
    { label: 'STRING', call: "greet('Ada')", result: results.string ?? 'Waiting' },
    { label: 'ARRAY', call: 'scaleValues([1, 2, 3])', result: results.array ?? 'Waiting' },
    { label: 'OBJECT', call: 'annotateObject(profile)', result: results.object ?? 'Waiting' },
    { label: 'PROMISE', call: 'calculateAsync(21)', result: promiseResult },
    { label: 'CALLBACK', call: 'inspectWithCallback(profile, fn)', result: callbackResult },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" backgroundColor="#163B2C" />
      <View style={styles.header}>
        <Text style={styles.kicker}>NATIVE TYPE SHOWCASE</Text>
        <Text style={styles.title}>Rust + React Native</Text>
        <Text style={styles.subtitle}>Live calls across the TurboModule boundary</Text>
        <Pressable accessibilityRole="button" onPress={runExamples} style={styles.button}>
          <Text style={styles.buttonText}>Run examples</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {rows.map((row, index) => (
          <View key={`${row.label}-${row.call}`} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.type}>{row.label}</Text>
              <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={styles.call}>{row.call}</Text>
            <Text selectable style={styles.result}>{row.result}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footer}>Rust handlers · generated C++ bindings · native results</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F5EF',
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 24,
    backgroundColor: '#163B2C',
  },
  kicker: {
    color: '#C8E98A',
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 5,
    color: '#D0DED5',
    fontSize: 14,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 6,
    backgroundColor: '#C8E98A',
  },
  buttonText: {
    color: '#163B2C',
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 9,
  },
  row: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#DFE5DC',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    color: '#347353',
    fontSize: 10,
    fontWeight: '800',
  },
  index: {
    color: '#A1AAA1',
    fontSize: 11,
    fontWeight: '700',
  },
  call: {
    marginTop: 7,
    color: '#27372D',
    fontSize: 14,
    fontWeight: '600',
  },
  result: {
    marginTop: 6,
    color: '#69766D',
    fontSize: 13,
  },
  footer: {
    marginHorizontal: 22,
    marginTop: 18,
    color: '#69766D',
    fontSize: 11,
  },
});
