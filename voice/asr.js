#!/usr/bin/env node

// ASR (Automatic Speech Recognition) using sherpa-onnx binary
// No Python required!

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const SHERPA_BINARY = join(process.cwd(), 'voice/bin/sherpa-onnx');
const ASR_MODEL_PATH = join(process.cwd(), 'models/asr/sherpa-onnx-streaming-zipformer-small-2024-03-25');

class ASR {
  constructor() {
    this.isRecording = false;
  }

  async initialize() {
    if (!existsSync(SHERPA_BINARY)) {
      throw new Error(`sherpa-onnx binary not found at ${SHERPA_BINARY}\nRun: ./voice/install-binary.sh`);
    }
    if (!existsSync(ASR_MODEL_PATH)) {
      throw new Error(`ASR model not found at ${ASR_MODEL_PATH}\nRun: ./voice/install-binary.sh`);
    }
    console.log('🎤 ASR initialized (sherpa-onnx binary)');
    return true;
  }

  async recordAudio(durationSeconds = 5) {
    return new Promise((resolve, reject) => {
      const audioFile = `/tmp/speech_${Date.now()}.wav`;

      const sox = spawn('rec', [
        '-r', '16000',
        '-c', '1',
        '-b', '16',
        '-t', 'wav',
        audioFile,
        'trim', '0', durationSeconds.toString()
      ]);

      console.log(`🎙️  Recording for ${durationSeconds}s... Speak now!`);

      sox.on('close', (code) => {
        if (code === 0) resolve(audioFile);
        else reject(new Error(`Recording failed: ${code}`));
      });
    });
  }

  async transcribe(audioFile) {
    return new Promise((resolve, reject) => {
      // Call sherpa-onnx binary directly
      const sherpa = spawn(SHERPA_BINARY, [
        '--tokens', `${ASR_MODEL_PATH}/tokens.txt`,
        '--nn-model', `${ASR_MODEL_PATH}/model.int8.onnx`,
        '--sample-rate', '16000',
        '--feature-dim', '80',
        '--wav-file', audioFile,
        '--decoding-method', 'greedy_search'
      ]);

      let output = '';
      sherpa.stdout.on('data', (data) => {
        output += data.toString();
      });

      sherpa.stderr.on('data', (data) => {
        console.error(`ASR: ${data}`);
      });

      sherpa.on('close', (code) => {
        if (code === 0) resolve(output.trim() || '');
        else reject(new Error(`Transcription failed: ${code}`));
      });
    });
  }

  async listen(durationSeconds = 5) {
    try {
      const audioFile = await this.recordAudio(durationSeconds);
      const text = await this.transcribe(audioFile);

      // Cleanup
      import('fs').then(({ unlinkSync }) => {
        try { unlinkSync(audioFile); } catch {}
      });

      return text;
    } catch (error) {
      console.error(`❌ ASR error: ${error.message}`);
      return '';
    }
  }

  async listenContinuous(callback) {
    this.isRecording = true;
    console.log('🎙️  Continuous listening... (say "stop listening" to end)');

    while (this.isRecording) {
      const text = await this.listen(5);
      if (text) {
        if (text.toLowerCase().includes('stop listening')) {
          this.isRecording = false;
          break;
        }
        callback(text);
      }
    }
  }

  stopListening() {
    this.isRecording = false;
  }
}

export default ASR;
