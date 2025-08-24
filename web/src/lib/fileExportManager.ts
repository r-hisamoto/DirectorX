/**
 * File Export Manager
 * ファイル出力とダウンロード管理を担当
 */

import { RenderOutput } from './renderService';
import { VideoRecipe } from './recipeEngine';
import { TTSResult } from './ttsService';

export interface ExportJob {
  id: string;
  type: 'single' | 'batch' | 'project';
  files: ExportFile[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ExportFile {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle' | 'script' | 'thumbnail' | 'project';
  mimeType: string;
  size: number;
  blob?: Blob;
  url?: string;
  metadata?: any;
}

export interface ProjectExport {
  version: string;
  recipe: VideoRecipe;
  assets: any[];
  timestamp: Date;
}

export class FileExportManager {
  private jobs: Map<string, ExportJob> = new Map();
  private zipWorker: Worker | null = null;

  constructor() {
    this.initializeZipWorker();
  }

  // ZIP Worker初期化（大きなファイル処理用）
  private initializeZipWorker(): void {
    try {
      // 実際のプロジェクトでは、zip.jsなどのライブラリを使用
      // this.zipWorker = new Worker('zip-worker.js');
    } catch (error) {
      console.warn('ZIP Worker initialization failed:', error);
    }
  }

  // 単一ファイルエクスポート
  async exportSingleFile(output: RenderOutput): Promise<string> {
    if (!output.url) {
      throw new Error('File URL not available');
    }

    // ダウンロードリンク作成
    const link = document.createElement('a');
    link.href = output.url;
    link.download = output.filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return output.filename;
  }

  // バッチエクスポート
  async exportBatch(outputs: RenderOutput[], projectName: string): Promise<ExportJob> {
    const job: ExportJob = {
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'batch',
      files: [],
      status: 'pending',
      createdAt: new Date()
    };

    this.jobs.set(job.id, job);

    try {
      job.status = 'processing';

      // ファイルを準備
      for (const output of outputs) {
        if (output.url) {
          const response = await fetch(output.url);
          const blob = await response.blob();
          
          const exportFile: ExportFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: output.filename,
            type: output.type,
            mimeType: output.mimeType,
            size: blob.size,
            blob,
            url: output.url,
            metadata: {
              duration: output.duration
            }
          };
          
          job.files.push(exportFile);
        }
      }

      // ZIPファイル作成
      const zipBlob = await this.createZipFile(job.files, projectName);
      const zipUrl = URL.createObjectURL(zipBlob);
      
      // ZIPファイルダウンロード
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `${projectName}_export.zip`;
      link.click();
      
      // クリーンアップ
      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
      }, 1000);

      job.status = 'completed';
      job.completedAt = new Date();
      
      return job;
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  // プロジェクトファイルエクスポート
  async exportProject(recipe: VideoRecipe, outputs: RenderOutput[]): Promise<ExportFile> {
    const projectData: ProjectExport = {
      version: '1.0.0',
      recipe,
      assets: [], // 実際のプロジェクトでは関連アセットを含める
      timestamp: new Date()
    };

    const projectJson = JSON.stringify(projectData, null, 2);
    const projectBlob = new Blob([projectJson], { type: 'application/json' });
    const projectUrl = URL.createObjectURL(projectBlob);

    const exportFile: ExportFile = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.directorx`,
      type: 'project',
      mimeType: 'application/json',
      size: projectBlob.size,
      blob: projectBlob,
      url: projectUrl,
      metadata: {
        version: projectData.version,
        recipeId: recipe.id,
        outputCount: outputs.length
      }
    };

    return exportFile;
  }

  // 字幕ファイル生成
  async generateSubtitleFile(
    recipe: VideoRecipe, 
    format: 'srt' | 'vtt' | 'ass' = 'srt'
  ): Promise<ExportFile> {
    let content = '';
    
    switch (format) {
      case 'srt':
        content = recipe.srtContent || this.generateSRTFromRecipe(recipe);
        break;
      case 'vtt':
        content = this.convertSRTToVTT(recipe.srtContent || this.generateSRTFromRecipe(recipe));
        break;
      case 'ass':
        content = this.convertSRTToASS(recipe.srtContent || this.generateSRTFromRecipe(recipe));
        break;
    }

    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return {
      id: `subtitle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`,
      type: 'subtitle',
      mimeType: 'text/plain',
      size: blob.size,
      blob,
      url
    };
  }

  // 台本ファイル生成
  async generateScriptFile(
    recipe: VideoRecipe, 
    format: 'txt' | 'md' | 'pdf' = 'txt'
  ): Promise<ExportFile> {
    let content = '';
    let mimeType = 'text/plain';
    
    switch (format) {
      case 'txt':
        content = recipe.scriptContent;
        mimeType = 'text/plain';
        break;
      case 'md':
        content = this.convertScriptToMarkdown(recipe);
        mimeType = 'text/markdown';
        break;
      case 'pdf':
        // PDFの場合、実際のプロジェクトではPDF生成ライブラリを使用
        content = recipe.scriptContent;
        mimeType = 'application/pdf';
        break;
    }

    const blob = new Blob([content], { type: `${mimeType}; charset=utf-8` });
    const url = URL.createObjectURL(blob);

    return {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${recipe.title.replace(/[^a-zA-Z0-9]/g, '_')}_script.${format}`,
      type: 'script',
      mimeType,
      size: blob.size,
      blob,
      url
    };
  }

  // 音声ファイル生成（TTSから）
  async generateAudioFile(
    ttsResult: TTSResult, 
    format: 'mp3' | 'wav' | 'ogg' = 'mp3'
  ): Promise<ExportFile> {
    // 実際の実装では、Web Speech APIの出力を指定されたフォーマットに変換
    // ここではダミーの音声データを生成
    
    const audioContext = new AudioContext();
    const buffer = audioContext.createBuffer(2, audioContext.sampleRate * ttsResult.totalDuration, audioContext.sampleRate);
    
    // 簡単な音声データ生成（実際はTTSから取得）
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const nowBuffering = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        // サイン波生成（デモ用）
        nowBuffering[i] = Math.sin(440 * 2 * Math.PI * i / audioContext.sampleRate) * 0.1;
      }
    }

    // AudioBufferをBlobに変換（実際の実装では適切なエンコーダーを使用）
    const audioData = new ArrayBuffer(buffer.length * 4);
    const view = new DataView(audioData);
    
    // 簡単なWAVヘッダー付きでダミーデータ作成
    const blob = new Blob([audioData], { type: this.getAudioMimeType(format) });
    const url = URL.createObjectURL(blob);

    return {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `audio.${format}`,
      type: 'audio',
      mimeType: this.getAudioMimeType(format),
      size: blob.size,
      blob,
      url,
      metadata: {
        duration: ttsResult.totalDuration,
        segmentCount: ttsResult.segments.length
      }
    };
  }

  // ZIPファイル作成（簡易版）
  private async createZipFile(files: ExportFile[], projectName: string): Promise<Blob> {
    // 実際の実装では、JSZipなどのライブラリを使用
    // ここでは複数ファイルを順次ダウンロードする代替処理
    
    for (const file of files) {
      if (file.url) {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.click();
        
        // ダウンロード間隔
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // ダミーZIPファイル（実際の実装では適切なZIP生成）
    return new Blob(['ZIP file placeholder'], { type: 'application/zip' });
  }

  // SRTからVTT変換
  private convertSRTToVTT(srtContent: string): string {
    let vtt = 'WEBVTT\n\n';
    
    const srtBlocks = srtContent.split('\n\n').filter(block => block.trim());
    
    srtBlocks.forEach(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeCode = lines[1].replace(/,/g, '.');
        const text = lines.slice(2).join('\n');
        vtt += `${timeCode}\n${text}\n\n`;
      }
    });
    
    return vtt;
  }

  // SRTからASS変換
  private convertSRTToASS(srtContent: string): string {
    let ass = `[Script Info]
Title: DirectorX Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const srtBlocks = srtContent.split('\n\n').filter(block => block.trim());
    
    srtBlocks.forEach(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeCodes = lines[1].split(' --> ');
        const start = this.convertSRTTimeToASS(timeCodes[0]);
        const end = this.convertSRTTimeToASS(timeCodes[1]);
        const text = lines.slice(2).join('\\N');
        
        ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
      }
    });
    
    return ass;
  }

  // SRT時刻をASS形式に変換
  private convertSRTTimeToASS(srtTime: string): string {
    return srtTime.replace(',', '.').substring(0, 11);
  }

  // 台本をMarkdown形式に変換
  private convertScriptToMarkdown(recipe: VideoRecipe): string {
    let markdown = `# ${recipe.title}\n\n`;
    
    if (recipe.description) {
      markdown += `${recipe.description}\n\n`;
    }
    
    markdown += `## 制作情報\n\n`;
    markdown += `- 作成日時: ${recipe.createdAt.toLocaleString()}\n`;
    markdown += `- 解像度: ${recipe.videoConfig.resolution}\n`;
    markdown += `- フレームレート: ${recipe.videoConfig.frameRate} FPS\n`;
    
    if (recipe.ttsResult) {
      markdown += `- 音声長: ${recipe.ttsResult.totalDuration}秒\n`;
      markdown += `- セグメント数: ${recipe.ttsResult.segments.length}\n`;
    }
    
    markdown += '\n## 台本内容\n\n';
    markdown += recipe.scriptContent;
    
    if (recipe.srtContent) {
      markdown += '\n\n## 字幕データ\n\n```srt\n';
      markdown += recipe.srtContent;
      markdown += '\n```\n';
    }
    
    return markdown;
  }

  // レシピからSRT生成
  private generateSRTFromRecipe(recipe: VideoRecipe): string {
    if (recipe.srtContent) {
      return recipe.srtContent;
    }

    // 台本からSRT生成（簡易版）
    const lines = recipe.scriptContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    let srt = '';
    let currentTime = 0;

    lines.forEach((line, index) => {
      if (line.trim()) {
        const duration = Math.max(2, Math.min(8, line.length * 0.2));
        
        const startTimeStr = this.formatSRTTime(currentTime);
        const endTimeStr = this.formatSRTTime(currentTime + duration);
        
        srt += `${index + 1}\n`;
        srt += `${startTimeStr} --> ${endTimeStr}\n`;
        srt += `${line}\n\n`;
        
        currentTime += duration + 0.5;
      }
    });

    return srt;
  }

  // SRT時刻フォーマット
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  // 音声MIMEタイプ取得
  private getAudioMimeType(format: string): string {
    switch (format) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      default: return 'audio/mpeg';
    }
  }

  // ジョブ取得
  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  // 全ジョブ取得
  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  // ジョブ削除
  deleteJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      // Blob URLをクリーンアップ
      job.files.forEach(file => {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      });
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }

  // 一括クリーンアップ
  cleanup(): void {
    this.jobs.forEach(job => {
      job.files.forEach(file => {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      });
    });
    this.jobs.clear();

    if (this.zipWorker) {
      this.zipWorker.terminate();
      this.zipWorker = null;
    }
  }
}

export default FileExportManager;