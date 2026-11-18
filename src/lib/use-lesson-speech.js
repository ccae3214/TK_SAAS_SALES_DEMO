"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoice, speechSupported } from '@/lib/hr-speech';

// 學習頁的語音朗讀 hook：包裝瀏覽器內建的 speechSynthesis。
// play(queue, { rate }) 會依序唸 queue 裡的 { rowKey, text, lang }；playingKey 是目前正在唸的那一列。
export function useLessonSpeech() {
  const [supported, setSupported] = useState(false);
  const [checked, setChecked] = useState(false);
  const [voices, setVoices] = useState([]);
  const [playingKey, setPlayingKey] = useState('');
  const [error, setError] = useState(false);
  const runRef = useRef(0);
  const voicesRef = useRef([]);

  useEffect(() => {
    setChecked(true);
    if (!speechSupported()) return undefined;
    const synth = window.speechSynthesis;
    const load = () => {
      const list = synth.getVoices() || [];
      voicesRef.current = list;
      setVoices(list);
    };
    setSupported(true);
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      runRef.current += 1;
      synth.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setPlayingKey('');
  }, []);

  const play = useCallback((queue, { rate = 1 } = {}) => {
    if (!speechSupported() || !Array.isArray(queue) || !queue.length) return;
    const synth = window.speechSynthesis;
    runRef.current += 1;
    const run = runRef.current;
    synth.cancel();
    setError(false);
    let index = 0;
    const next = () => {
      if (run !== runRef.current) return;
      if (index >= queue.length) { setPlayingKey(''); return; }
      const item = queue[index];
      index += 1;
      const utterance = new window.SpeechSynthesisUtterance(item.text);
      utterance.lang = item.lang;
      utterance.rate = rate;
      const voice = pickVoice(voicesRef.current, item.lang);
      if (voice) utterance.voice = voice;
      utterance.onend = next;
      utterance.onerror = event => {
        if (run !== runRef.current) return;
        if (event?.error === 'canceled' || event?.error === 'interrupted') return;
        runRef.current += 1;
        setPlayingKey('');
        setError(true);
      };
      setPlayingKey(item.rowKey);
      synth.speak(utterance);
    };
    next();
  }, []);

  const missingChineseVoice = supported && voices.length > 0 && !pickVoice(voices, 'zh-TW');
  return { supported, checked, playingKey, error, missingChineseVoice, play, stop };
}
