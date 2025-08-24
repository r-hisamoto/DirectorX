import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Settings,
  Download,
  RefreshCw,
  Headphones,
  Mic,
  User,
  Users,
  Clock,
  FileAudio,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { ttsService, type TTSVoice, type TTSOptions, type TTSResult, type TTSSegment } from '@/lib/ttsService';

interface TTSPanelProps {
  scriptContent?: string;
  srtContent?: string;
  onAudioGenerated?: (result: TTSResult) => void;
  onError?: (error: string) => void;
}

export function TTSPanel({
  scriptContent = '',
  srtContent = '',
  onAudioGenerated,
  onError
}: TTSPanelProps) {
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice | null>(null);
  const [ttsOptions, setTTSOptions] = useState<TTSOptions>({
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<TTSResult | null>(null);
  const [previewText, setPreviewText] = useState('');

  // 音声一覧の初期化
  useEffect(() => {
    const initializeVoices = async () => {
      try {
        const voices = await ttsService.getAvailableVoices();
        setAvailableVoices(voices);
        
        // デフォルトで日本語音声を選択
        const japaneseVoice = voices.find(v => v.lang.startsWith('ja')) || voices[0];
        if (japaneseVoice) {
          setSelectedVoice(japaneseVoice);
        }
      } catch (error) {
        console.error('Failed to initialize TTS voices:', error);
        onError?.('音声エンジンの初期化に失敗しました');
      }
    };

    initializeVoices();
  }, [onError]);

  // プレビューテキストの設定
  useEffect(() => {
    if (scriptContent) {
      // 台本の最初の数行を抽出
      const lines = scriptContent
        .replace(/^#+\s+.*/gm, '')
        .split('\n')
        .filter(line => line.trim())
        .slice(0, 3);
      
      setPreviewText(lines.join(' ').slice(0, 100) + (lines.join(' ').length > 100 ? '...' : ''));
    } else {
      setPreviewText('台本を入力すると、ここにプレビューが表示されます。');
    }
  }, [scriptContent]);

  // TTS生成の実行
  const handleGenerate = async () => {
    if (!scriptContent && !srtContent) {
      onError?.('生成する台本またはSRTが入力されていません');
      return;
    }

    if (!selectedVoice) {
      onError?.('音声を選択してください');
      return;
    }

    setIsGenerating(true);
    try {
      const options: TTSOptions = {
        voice: selectedVoice,
        ...ttsOptions
      };

      let result: TTSResult;
      if (srtContent) {
        result = await ttsService.generateFromSRT(srtContent, options);
      } else {
        result = await ttsService.generateFromScript(scriptContent, options);
      }

      if (result.success) {
        setGeneratedResult(result);
        onAudioGenerated?.(result);
        console.log(`TTS generation completed: ${result.segments.length} segments, ${result.totalDuration}s`);
      } else {
        onError?.(result.error || 'TTS生成に失敗しました');
      }
    } catch (error) {
      console.error('TTS generation error:', error);
      onError?.(`TTS生成エラー: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // プレビュー再生
  const handlePreviewPlay = async () => {
    if (!selectedVoice || !previewText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(previewText);
      const voices = await ttsService.getAvailableVoices();
      const voice = voices.find(v => v.id === selectedVoice.id);
      
      if (voice) {
        // Web Speech APIの音声設定
        const speechVoices = window.speechSynthesis.getVoices();
        const speechVoice = speechVoices.find(v => v.name === voice.id);
        if (speechVoice) {
          utterance.voice = speechVoice;
        }
      }

      utterance.rate = ttsOptions.rate || 1.0;
      utterance.pitch = ttsOptions.pitch || 1.0;
      utterance.volume = ttsOptions.volume || 1.0;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Preview play error:', error);
      onError?.('プレビュー再生に失敗しました');
    }
  };

  // 再生停止
  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  // 音声品質のプリセット
  const qualityPresets = [
    { name: '高速', rate: 1.4, pitch: 1.0, description: '短時間での確認用' },
    { name: '標準', rate: 1.0, pitch: 1.0, description: '一般的な読み上げ' },
    { name: 'ゆっくり', rate: 0.8, pitch: 1.0, description: '聞き取りやすい速度' },
    { name: '低音', rate: 1.0, pitch: 0.8, description: '落ち着いた印象' },
    { name: '高音', rate: 1.0, pitch: 1.2, description: '明るい印象' }
  ];

  // 音声フィルタリング
  const maleVoices = availableVoices.filter(v => v.gender === 'male');
  const femaleVoices = availableVoices.filter(v => v.gender === 'female');
  const neutralVoices = availableVoices.filter(v => v.gender === 'neutral');

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 音声選択セクション */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Headphones className="w-4 h-4 mr-2" />
          音声選択
        </h4>

        {/* 音声カテゴリ */}
        <div className="space-y-3">
          {/* 男性音声 */}
          {maleVoices.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center">
                <User className="w-3 h-3 mr-1" />
                男性音声 ({maleVoices.length}件)
              </div>
              <div className="grid grid-cols-1 gap-1">
                {maleVoices.slice(0, 2).map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice)}
                    className={`text-left px-2 py-1.5 rounded text-xs border transition-colors ${
                      selectedVoice?.id === voice.id
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{voice.name.split(' ')[0]}</div>
                    <div className="text-gray-500 text-xs">{voice.lang}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 女性音声 */}
          {femaleVoices.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center">
                <Users className="w-3 h-3 mr-1" />
                女性音声 ({femaleVoices.length}件)
              </div>
              <div className="grid grid-cols-1 gap-1">
                {femaleVoices.slice(0, 2).map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice)}
                    className={`text-left px-2 py-1.5 rounded text-xs border transition-colors ${
                      selectedVoice?.id === voice.id
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{voice.name.split(' ')[0]}</div>
                    <div className="text-gray-500 text-xs">{voice.lang}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 音声設定 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          音声設定
        </h4>

        {/* プリセット */}
        <div className="mb-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">プリセット</div>
          <div className="grid grid-cols-2 gap-1">
            {qualityPresets.slice(0, 4).map((preset) => (
              <button
                key={preset.name}
                onClick={() => setTTSOptions({ 
                  ...ttsOptions, 
                  rate: preset.rate, 
                  pitch: preset.pitch 
                })}
                className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-700"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* 詳細設定 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 dark:text-gray-300">速度</span>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={ttsOptions.rate}
                onChange={(e) => setTTSOptions({ ...ttsOptions, rate: parseFloat(e.target.value) })}
                className="w-16 h-1"
              />
              <span className="text-xs text-gray-500 w-8">{ttsOptions.rate?.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 dark:text-gray-300">ピッチ</span>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={ttsOptions.pitch}
                onChange={(e) => setTTSOptions({ ...ttsOptions, pitch: parseFloat(e.target.value) })}
                className="w-16 h-1"
              />
              <span className="text-xs text-gray-500 w-8">{ttsOptions.pitch?.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700 dark:text-gray-300">音量</span>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={ttsOptions.volume}
                onChange={(e) => setTTSOptions({ ...ttsOptions, volume: parseFloat(e.target.value) })}
                className="w-16 h-1"
              />
              <span className="text-xs text-gray-500 w-8">{ttsOptions.volume?.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* プレビューエリア */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Mic className="w-4 h-4 mr-2" />
          プレビュー
        </h4>

        <div className="bg-white dark:bg-gray-700 rounded p-3 mb-3">
          <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {previewText}
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handlePreviewPlay}
            disabled={isPlaying || !selectedVoice}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
          >
            <Play className="w-3 h-3" />
            <span>試聴</span>
          </button>
          
          <button
            onClick={handleStop}
            disabled={!isPlaying}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded text-xs font-medium"
          >
            <Square className="w-3 h-3" />
            <span>停止</span>
          </button>
        </div>
      </div>

      {/* 生成コントロール */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <FileAudio className="w-4 h-4 mr-2" />
          音声生成
        </h4>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!scriptContent && !srtContent) || !selectedVoice}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm font-medium"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Headphones className="w-4 h-4" />
              <span>音声生成開始</span>
            </>
          )}
        </button>

        {/* 生成結果 */}
        {generatedResult && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                音声生成完了
              </span>
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              セグメント数: {generatedResult.segments.length} / 
              推定時間: {Math.round(generatedResult.totalDuration)}秒
            </div>
          </div>
        )}
      </div>
    </div>
  );
}