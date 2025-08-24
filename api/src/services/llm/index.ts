/**
 * DirectorX LLM Service
 * 台本生成・5chコメント生成のためのLLM統合サービス
 */

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';

export interface LLMProvider {
  name: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ScriptGenerationRequest {
  assetIds: string[];
  sourceContent: string;
  style: 'narrative' | 'commentary' | 'news' | 'discussion';
  maxLength: number;
  channelInfo?: {
    name: string;
    theme: string;
    tone: string;
  };
}

export interface ScriptGenerationResult {
  title: string;
  outline: string[];
  body: string;
  metadata: {
    wordCount: number;
    estimatedDuration: number;
    generationTime: number;
    model: string;
  };
}

export interface CommentsGenerationRequest {
  assetId: string;
  sourceContent: string;
  count: number;
  style: '5ch' | 'youtube' | 'twitter';
  channelContext?: string;
}

export interface CommentsGenerationResult {
  comments: GeneratedComment[];
  metadata: {
    total: number;
    generationTime: number;
    model: string;
  };
}

export interface GeneratedComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  style: 'positive' | 'negative' | 'neutral' | 'question';
  category: 'reaction' | 'analysis' | 'joke' | 'information';
}

export class LLMService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private defaultProvider: LLMProvider;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.defaultProvider = {
      name: 'openai',
      model: 'gpt-4o-mini',
      maxTokens: 4000,
      temperature: 0.7
    };
  }

  // 台本生成
  async generateScript(request: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const startTime = Date.now();
    
    try {
      const systemPrompt = this.buildScriptSystemPrompt(request.style, request.channelInfo);
      const userPrompt = this.buildScriptUserPrompt(request);

      let result: ScriptGenerationResult;

      // プロバイダー選択（フォールバック付き）
      try {
        result = await this.generateWithOpenAI(systemPrompt, userPrompt, 'script');
      } catch (error) {
        logger.warn('OpenAI failed, falling back to Anthropic:', error);
        result = await this.generateWithAnthropic(systemPrompt, userPrompt, 'script');
      }

      // メタデータ更新
      result.metadata.generationTime = Date.now() - startTime;
      result.metadata.estimatedDuration = this.estimateDuration(result.body);

      logger.info(`Script generated: ${result.metadata.wordCount} words in ${result.metadata.generationTime}ms`);
      return result;

    } catch (error) {
      logger.error('Script generation failed:', error);
      throw new Error(`台本生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 5chコメント生成
  async generateComments(request: CommentsGenerationRequest): Promise<CommentsGenerationResult> {
    const startTime = Date.now();
    
    try {
      const systemPrompt = this.buildCommentsSystemPrompt(request.style);
      const userPrompt = this.buildCommentsUserPrompt(request);

      let comments: GeneratedComment[];

      // プロバイダー選択（フォールバック付き）
      try {
        comments = await this.generateCommentsWithOpenAI(systemPrompt, userPrompt, request.count);
      } catch (error) {
        logger.warn('OpenAI failed, falling back to Anthropic:', error);
        comments = await this.generateCommentsWithAnthropic(systemPrompt, userPrompt, request.count);
      }

      const result: CommentsGenerationResult = {
        comments,
        metadata: {
          total: comments.length,
          generationTime: Date.now() - startTime,
          model: this.defaultProvider.model
        }
      };

      logger.info(`Comments generated: ${comments.length} comments in ${result.metadata.generationTime}ms`);
      return result;

    } catch (error) {
      logger.error('Comments generation failed:', error);
      throw new Error(`コメント生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OpenAI台本生成
  private async generateWithOpenAI(systemPrompt: string, userPrompt: string, type: 'script'): Promise<ScriptGenerationResult> {
    const completion = await this.openai.chat.completions.create({
      model: this.defaultProvider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: this.defaultProvider.maxTokens,
      temperature: this.defaultProvider.temperature,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      title: parsed.title || '生成されたタイトル',
      outline: parsed.outline || [],
      body: parsed.body || '',
      metadata: {
        wordCount: (parsed.body || '').length,
        estimatedDuration: 0,
        generationTime: 0,
        model: this.defaultProvider.model
      }
    };
  }

  // Anthropic台本生成
  private async generateWithAnthropic(systemPrompt: string, userPrompt: string, type: 'script'): Promise<ScriptGenerationResult> {
    const completion = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: this.defaultProvider.maxTokens,
      temperature: this.defaultProvider.temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = completion.content[0];
    if (content.type !== 'text') {
      throw new Error('Invalid response from Anthropic');
    }

    const parsed = JSON.parse(content.text);
    
    return {
      title: parsed.title || '生成されたタイトル',
      outline: parsed.outline || [],
      body: parsed.body || '',
      metadata: {
        wordCount: (parsed.body || '').length,
        estimatedDuration: 0,
        generationTime: 0,
        model: 'claude-3-haiku-20240307'
      }
    };
  }

  // OpenAI コメント生成
  private async generateCommentsWithOpenAI(systemPrompt: string, userPrompt: string, count: number): Promise<GeneratedComment[]> {
    const completion = await this.openai.chat.completions.create({
      model: this.defaultProvider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.comments || [];
  }

  // Anthropic コメント生成
  private async generateCommentsWithAnthropic(systemPrompt: string, userPrompt: string, count: number): Promise<GeneratedComment[]> {
    const completion = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = completion.content[0];
    if (content.type !== 'text') {
      throw new Error('Invalid response from Anthropic');
    }

    const parsed = JSON.parse(content.text);
    return parsed.comments || [];
  }

  // 台本用システムプロンプト構築
  private buildScriptSystemPrompt(style: string, channelInfo?: any): string {
    const basePrompt = `あなたは日本語動画コンテンツの台本作成の専門家です。`;
    
    const stylePrompts = {
      narrative: '物語風の構成で、導入→展開→結論の流れを意識した台本を作成してください。',
      commentary: '解説系動画として、視聴者に分かりやすく情報を伝える台本を作成してください。',
      news: 'ニュース番組風に、客観的で簡潔な報道スタイルの台本を作成してください。',
      discussion: '議論・討論形式で、複数の視点を提示する台本を作成してください。'
    };

    let channelContext = '';
    if (channelInfo) {
      channelContext = `チャンネル情報: ${channelInfo.name}（テーマ: ${channelInfo.theme}、トーン: ${channelInfo.tone}）`;
    }

    return `${basePrompt}
${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.commentary}
${channelContext}

出力は以下のJSON形式で返してください:
{
  "title": "動画タイトル（魅力的で検索に引っかかりやすい）",
  "outline": ["見出し1", "見出し2", "見出し3"],
  "body": "台本本文（2000-3000文字）"
}`;
  }

  // 台本用ユーザープロンプト構築
  private buildScriptUserPrompt(request: ScriptGenerationRequest): string {
    return `以下の素材から${request.maxLength}文字程度の台本を作成してください。

素材内容:
${request.sourceContent}

要求:
- スタイル: ${request.style}
- 文字数: ${request.maxLength}文字程度
- 日本語の自然な口調
- 視聴者の興味を引く構成
- SEOを意識したタイトル`;
  }

  // コメント用システムプロンプト構築
  private buildCommentsSystemPrompt(style: string): string {
    const stylePrompts = {
      '5ch': '5ちゃんねる風の短いコメントを生成してください。略語、顔文字、ネットスラングを適度に使用。',
      'youtube': 'YouTube風のコメントを生成してください。絵文字を使い、ポジティブな反応が多め。',
      'twitter': 'Twitter風の短いコメントを生成してください。ハッシュタグや簡潔な表現を使用。'
    };

    return `あなたは日本のインターネットコミュニティのコメントを生成する専門家です。
${stylePrompts[style as keyof typeof stylePrompts] || stylePrompts['5ch']}

出力は以下のJSON形式で返してください:
{
  "comments": [
    {
      "id": "1",
      "text": "コメント内容",
      "author": "ユーザー名",
      "timestamp": "2024-01-01T00:00:00Z",
      "style": "positive|negative|neutral|question",
      "category": "reaction|analysis|joke|information"
    }
  ]
}`;
  }

  // コメント用ユーザープロンプト構築
  private buildCommentsUserPrompt(request: CommentsGenerationRequest): string {
    return `以下の内容に対する${request.style}風のコメントを${request.count}件生成してください。

内容:
${request.sourceContent}

要求:
- コメント数: ${request.count}件
- スタイル: ${request.style}
- 多様な反応（ポジティブ・ネガティブ・中立・質問）
- 日本語として自然な表現
- 適度な長さ（20-100文字程度）
${request.channelContext ? `- チャンネル文脈: ${request.channelContext}` : ''}`;
  }

  // 動画長推定（日本語読み上げ速度ベース）
  private estimateDuration(text: string): number {
    // 日本語の平均読み上げ速度: 300-400文字/分
    const charactersPerMinute = 350;
    const minutes = text.length / charactersPerMinute;
    return Math.round(minutes * 60); // 秒
  }

  // プロバイダー設定更新
  setProvider(provider: LLMProvider): void {
    this.defaultProvider = provider;
    logger.info(`LLM provider updated: ${provider.name} (${provider.model})`);
  }

  // ヘルスチェック
  async healthCheck(): Promise<{ openai: boolean; anthropic: boolean }> {
    const results = { openai: false, anthropic: false };

    // OpenAI接続確認
    try {
      await this.openai.models.list();
      results.openai = true;
    } catch (error) {
      logger.warn('OpenAI health check failed:', error);
    }

    // Anthropic接続確認
    try {
      await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      results.anthropic = true;
    } catch (error) {
      logger.warn('Anthropic health check failed:', error);
    }

    return results;
  }
}

export default LLMService;