/**
 * speech.ts — reads narration aloud using the browser's built-in voices.
 * No accounts, no downloads: window.speechSynthesis ships with every modern
 * browser. Components keep their own on/off toggle and call speak()/stopSpeech().
 */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.startsWith('en') && /natural|neural|online/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en-GB')) ??
    voices.find((v) => v.lang.startsWith('en'))
  );
}

/** Speak `text`, replacing whatever was being spoken before. */
export function speak(text: string) {
  if (!speechAvailable()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function stopSpeech() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
