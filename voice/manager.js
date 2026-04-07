#!/usr/bin/env node

// Voice Manager - Coordinates ASR and TTS for hands-free operation

import ASR from './asr.js';
import TTS from './tts.js';

class VoiceManager {
  constructor(agent) {
    this.agent = agent;
    this.asr = new ASR();
    this.tts = new TTS();
    this.voiceMode = false;
    this.speakResponses = false;
    this.handsFree = false;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    try {
      await this.asr.initialize();
      await this.tts.initialize();
      this.initialized = true;
      console.log('✅ Voice system ready');
      return true;
    } catch (error) {
      console.error(`❌ Voice initialization failed: ${error.message}`);
      console.error('   Run: ./voice/install.sh');
      return false;
    }
  }

  async enableVoiceMode() {
    if (!await this.initialize()) {
      return false;
    }
    this.voiceMode = true;
    console.log('🎤 Voice mode: ON (speak commands)');
    return true;
  }

  async disableVoiceMode() {
    this.voiceMode = false;
    this.handsFree = false;
    console.log('🔇 Voice mode: OFF');
  }

  async enableSpeakResponses() {
    if (!await this.initialize()) {
      return false;
    }
    this.speakResponses = true;
    console.log('🔊 Speak responses: ON');
    return true;
  }

  disableSpeakResponses() {
    this.speakResponses = false;
    console.log('🔇 Speak responses: OFF');
  }

  async enableHandsFree() {
    if (!await this.initialize()) {
      return false;
    }
    this.handsFree = true;
    this.voiceMode = true;
    console.log('🎙️  Hands-free mode: ON (say "stop listening" to end)');
    this.startHandsFree();
    return true;
  }

  disableHandsFree() {
    this.handsFree = false;
    this.asr.stopListening();
    console.log('⏹️  Hands-free mode: OFF');
  }

  async startHandsFree() {
    const handleSpeech = async (text) => {
      console.log(`\n🎤 You (voice): ${text}`);
      
      // Process as if typed
      if (this.agent) {
        await this.agent.processInput(text);
      }
    };

    await this.asr.listenContinuous(handleSpeech);
  }

  async listenOnce() {
    if (!await this.initialize()) {
      return '';
    }

    console.log('🎤 Listening... (speak for 5 seconds)');
    const text = await this.asr.listen(5);
    
    if (text) {
      console.log(`🎤 You (voice): ${text}`);
    } else {
      console.log('❌ No speech detected');
    }

    return text;
  }

  async speakResponse(text) {
    if (!this.speakResponses || !text) {
      return;
    }

    try {
      // Truncate long responses
      const maxLength = 200;
      const truncated = text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;

      await this.tts.speakAndPlay(truncated);
    } catch (error) {
      console.error(`❌ Speech failed: ${error.message}`);
    }
  }

  getStatus() {
    return {
      voiceMode: this.voiceMode,
      speakResponses: this.speakResponses,
      handsFree: this.handsFree,
      initialized: this.initialized,
    };
  }

  async processVoiceCommand(command) {
    const cmd = command.toLowerCase().trim();

    // Voice-specific commands
    if (cmd === 'enable voice' || cmd === 'turn on voice') {
      await this.enableVoiceMode();
      return true;
    }

    if (cmd === 'disable voice' || cmd === 'turn off voice') {
      this.disableVoiceMode();
      return true;
    }

    if (cmd === 'speak' || cmd === 'enable speech') {
      await this.enableSpeakResponses();
      return true;
    }

    if (cmd === 'stop speaking' || cmd === 'disable speech') {
      this.disableSpeakResponses();
      return true;
    }

    if (cmd === 'hands free' || cmd === 'enable hands free') {
      await this.enableHandsFree();
      return true;
    }

    if (cmd === 'stop hands free' || cmd === 'disable hands free') {
      this.disableHandsFree();
      return true;
    }

    return false; // Not a voice command
  }
}

export default VoiceManager;
