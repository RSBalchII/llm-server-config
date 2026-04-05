#!/usr/bin/env node

// TTS (Text-to-Speech) using piper binary
// No Python required!

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const PIPER_BINARY = join(process.cwd(), 'voice/bin/piper');
const TTS_MODEL = join(process.cwd(), 'models/tts/en_US-lessac-medium.onnx');
const TTS_CONFIG = join(process.cwd(), 'models/tts/en_US-lessac-medium.onnx.json');

class TTS {
  constructor() {
    this.isSpeaking = false;
  }

  async initialize() {
    if (!existsSync(PIPER_BINARY)) {
      throw new Error(`piper binary not found at ${PIPER_BINARY}\nRun: ./voice/install-binary.sh`);
    }
    if (!existsSync(TTS_MODEL)) {
      throw new Error(`TTS model not found at ${TTS_MODEL}\nRun: ./voice/install-binary.sh`);
    }
    console.log('🔊 TTS initialized (piper binary)');
    return true;
  }

  async speak(text, outputFile = null) {
    if (!text || text.trim().length === 0) return null;

    return new Promise((resolve, reject) => {
      this.isSpeaking = true;
      const tempFile = outputFile || `/tmp/speech_${Date.now()}.wav`;

      const piper = spawn(PIPER_BINARY, [
        '-m', TTS_MODEL,
        '-c', TTS_CONFIG,
        '-f', tempFile
      ]);

      piper.stdin.write(text);
      piper.stdin.end();

      piper.stdout.on('data', (data) => {
        // Progress info
      });

      piper.stderr.on('data', (data) => {
        console.error(`TTS: ${data}`);
      });

      piper.on('close', (code) => {
        this.isSpeaking = false;
        if (code === 0) resolve(tempFile);
        else reject(new Error(`TTS failed: ${code}`));
      });
    });
  }

  async play(audioFile) {
    return new Promise((resolve, reject) => {
      const play = spawn('play', ['-v', '0.8', audioFile]);

      play.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Playback failed: ${code}`));
      });
    });
  }

  async speakAndPlay(text) {
    try {
      const audioFile = await this.speak(text);
      if (audioFile) {
        await this.play(audioFile);
        import('fs').then(({ unlinkSync }) => {
          try { unlinkSync(audioFile); } catch {}
        });
      }
    } catch (error) {
      console.error(`❌ TTS error: ${error.message}`);
    }
  }

  stop() {
    spawn('pkill', ['-f', 'play']);
    this.isSpeaking = false;
  }
}

export default TTS;
