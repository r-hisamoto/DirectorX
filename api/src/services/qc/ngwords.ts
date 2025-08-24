/**
 * DirectorX NGワード検出サービス
 * テキスト・音声転写内容のNGワード自動検出
 */

import { logger } from '../../lib/logger.js';

export interface NGWordResult {
  passed: boolean;
  violations: NGWordViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface NGWordViolation {
  word: string;
  category: NGWordCategory;
  context: string;
  position: number;
  severity: 'warning' | 'error' | 'critical';
  suggestion: string;
}

export type NGWordCategory = 
  | 'profanity'      // 下品・卑猥
  | 'discrimination' // 差別的表現
  | 'violence'       // 暴力的表現
  | 'political'      // 政治的
  | 'religious'      // 宗教的
  | 'personal'       // 個人情報
  | 'copyright'      // 著作権
  | 'medical'        // 医療・薬事
  | 'financial'      // 金融・投資勧誘
  | 'other';         // その他

export interface NGWordProfile {
  name: string;
  description: string;
  categories: {
    [K in NGWordCategory]: {
      enabled: boolean;
      words: string[];
      patterns: string[];
      severity: 'warning' | 'error' | 'critical';
    };
  };
  customRules: CustomRule[];
}

export interface CustomRule {
  pattern: string;
  category: NGWordCategory;
  severity: 'warning' | 'error' | 'critical';
  description: string;
}

export class NGWordService {
  private profiles: Map<string, NGWordProfile> = new Map();

  constructor() {
    this.loadDefaultProfiles();
  }

  // デフォルトプロファイル読み込み
  private loadDefaultProfiles(): void {
    // YouTube向けプロファイル
    const youtubeProfile: NGWordProfile = {
      name: 'YouTube Standard',
      description: 'YouTube配信向けの標準的なNGワード設定',
      categories: {
        profanity: {
          enabled: true,
          words: ['死ね', 'バカ', 'アホ', 'クソ', 'うざい'],
          patterns: ['/[死殺]/g', '/バ[カガ]/g'],
          severity: 'warning'
        },
        discrimination: {
          enabled: true,
          words: ['差別用語例'], // 実際の運用では適切な語彙を設定
          patterns: [],
          severity: 'error'
        },
        violence: {
          enabled: true,
          words: ['殺す', '爆弾', 'テロ'],
          patterns: ['/[殺害]/g'],
          severity: 'error'
        },
        political: {
          enabled: false,
          words: [],
          patterns: [],
          severity: 'warning'
        },
        religious: {
          enabled: false,
          words: [],
          patterns: [],
          severity: 'warning'
        },
        personal: {
          enabled: true,
          words: [],
          patterns: ['/\\d{3}-\\d{4}-\\d{4}/g', '/\\d{11}/g'], // 電話番号・個人番号
          severity: 'critical'
        },
        copyright: {
          enabled: true,
          words: ['無断転載', '著作権侵害'],
          patterns: [],
          severity: 'error'
        },
        medical: {
          enabled: true,
          words: ['薬事法', '医薬品', '治療効果'],
          patterns: [],
          severity: 'error'
        },
        financial: {
          enabled: true,
          words: ['必ず儲かる', '元本保証', '絶対に'],
          patterns: ['/\\d+%の利益/g', '/月収\\d+万円/g'],
          severity: 'error'
        },
        other: {
          enabled: true,
          words: [],
          patterns: [],
          severity: 'warning'
        }
      },
      customRules: []
    };

    this.profiles.set('youtube', youtubeProfile);

    // 企業向けプロファイル（より厳格）
    const corporateProfile: NGWordProfile = {
      ...youtubeProfile,
      name: 'Corporate Standard',
      description: '企業利用向けの厳格なNGワード設定',
      categories: {
        ...youtubeProfile.categories,
        profanity: {
          ...youtubeProfile.categories.profanity,
          severity: 'error'
        },
        political: {
          ...youtubeProfile.categories.political,
          enabled: true
        },
        religious: {
          ...youtubeProfile.categories.religious,
          enabled: true
        }
      }
    };

    this.profiles.set('corporate', corporateProfile);
  }

  // NGワードチェック実行
  async checkContent(
    text: string, 
    profileName = 'youtube',
    context = 'script'
  ): Promise<NGWordResult> {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`NGWord profile not found: ${profileName}`);
    }

    const violations: NGWordViolation[] = [];

    // 各カテゴリをチェック
    for (const [categoryName, category] of Object.entries(profile.categories)) {
      if (!category.enabled) continue;

      const categoryKey = categoryName as NGWordCategory;

      // 単語チェック
      for (const word of category.words) {
        const regex = new RegExp(word, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          const contextStart = Math.max(0, match.index - 20);
          const contextEnd = Math.min(text.length, match.index + word.length + 20);
          const contextText = text.substring(contextStart, contextEnd);

          violations.push({
            word,
            category: categoryKey,
            context: contextText,
            position: match.index,
            severity: category.severity,
            suggestion: this.getSuggestion(categoryKey, word)
          });
        }
      }

      // パターンチェック
      for (const pattern of category.patterns) {
        try {
          const regex = new RegExp(pattern.slice(1, -2), pattern.slice(-2, -1)); // /pattern/flags から抽出
          let match;
          
          while ((match = regex.exec(text)) !== null) {
            const contextStart = Math.max(0, match.index - 20);
            const contextEnd = Math.min(text.length, match.index + match[0].length + 20);
            const contextText = text.substring(contextStart, contextEnd);

            violations.push({
              word: match[0],
              category: categoryKey,
              context: contextText,
              position: match.index,
              severity: category.severity,
              suggestion: this.getSuggestion(categoryKey, match[0])
            });
          }
        } catch (error) {
          logger.warn(`Invalid regex pattern: ${pattern}`, error);
        }
      }
    }

    // カスタムルールチェック
    for (const rule of profile.customRules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          const contextStart = Math.max(0, match.index - 20);
          const contextEnd = Math.min(text.length, match.index + match[0].length + 20);
          const contextText = text.substring(contextStart, contextEnd);

          violations.push({
            word: match[0],
            category: rule.category,
            context: contextText,
            position: match.index,
            severity: rule.severity,
            suggestion: rule.description
          });
        }
      } catch (error) {
        logger.warn(`Invalid custom rule pattern: ${rule.pattern}`, error);
      }
    }

    // リスクレベル判定
    const riskLevel = this.calculateRiskLevel(violations);
    
    // 推奨事項生成
    const recommendations = this.generateRecommendations(violations);

    const passed = !violations.some(v => v.severity === 'critical' || v.severity === 'error');

    return {
      passed,
      violations,
      riskLevel,
      recommendations
    };
  }

  // リスクレベル計算
  private calculateRiskLevel(violations: NGWordViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (errorCount > 2) return 'high';
    if (errorCount > 0 || warningCount > 5) return 'medium';
    return 'low';
  }

  // 修正提案生成
  private getSuggestion(category: NGWordCategory, word: string): string {
    switch (category) {
      case 'profanity':
        return '表現を和らげるか、削除を検討してください';
      case 'discrimination':
        return '差別的表現を中立的な表現に変更してください';
      case 'violence':
        return '暴力的表現を削除または別の表現に変更してください';
      case 'personal':
        return '個人情報を削除または匿名化してください';
      case 'copyright':
        return '著作権に関する表現を確認し、適切なクレジット表示を行ってください';
      case 'medical':
        return '医療・薬事関連の表現は専門家の監修を推奨します';
      case 'financial':
        return '金融商品の勧誘表現は法的確認が必要です';
      default:
        return '表現の見直しを検討してください';
    }
  }

  // 推奨事項生成
  private generateRecommendations(violations: NGWordViolation[]): string[] {
    const recommendations: string[] = [];
    const categoryCount = new Map<NGWordCategory, number>();

    // カテゴリ別の違反数を集計
    for (const violation of violations) {
      categoryCount.set(violation.category, (categoryCount.get(violation.category) || 0) + 1);
    }

    // カテゴリ別推奨事項
    for (const [category, count] of categoryCount) {
      switch (category) {
        case 'profanity':
          if (count > 3) {
            recommendations.push('全体的な表現の見直しが必要です');
          }
          break;
        case 'personal':
          recommendations.push('個人情報保護の観点から内容を再確認してください');
          break;
        case 'copyright':
          recommendations.push('著作権チームでの確認を推奨します');
          break;
        case 'medical':
        case 'financial':
          recommendations.push('法務部門での確認が必要です');
          break;
      }
    }

    if (recommendations.length === 0 && violations.length > 0) {
      recommendations.push('指摘された箇所の修正をお願いします');
    }

    return recommendations;
  }

  // プロファイル取得
  getProfile(name: string): NGWordProfile | undefined {
    return this.profiles.get(name);
  }

  // プロファイル一覧
  listProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  // カスタムプロファイル追加
  addProfile(name: string, profile: NGWordProfile): void {
    this.profiles.set(name, profile);
    logger.info(`NGWord profile added: ${name}`);
  }
}

export default NGWordService;