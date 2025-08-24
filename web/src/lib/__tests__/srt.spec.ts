import { formatSrt, parseSrt, stringifySrt, wrapTextWithKinsoku, getCharWidth } from '../srt';

describe('JP SRT', () => {
  describe('Character width calculation', () => {
    it('calculates ASCII characters as half-width', () => {
      expect(getCharWidth('a')).toBe(0.5);
      expect(getCharWidth('A')).toBe(0.5);
      expect(getCharWidth('1')).toBe(0.5);
      expect(getCharWidth(' ')).toBe(0.5);
    });

    it('calculates Japanese characters as full-width', () => {
      expect(getCharWidth('あ')).toBe(1.0);
      expect(getCharWidth('漢')).toBe(1.0);
      expect(getCharWidth('カ')).toBe(1.0);
    });

    it('calculates half-width katakana as half-width', () => {
      expect(getCharWidth('ｱ')).toBe(0.5);
      expect(getCharWidth('ｶ')).toBe(0.5);
    });
  });

  describe('Text wrapping with kinsoku rules', () => {
    it('wraps at 20 zenkaku and forbids leading punctuation', () => {
      const longText = 'これは非常に長いテキストです、句読点が行頭に来ないようにします。';
      const lines = wrapTextWithKinsoku(longText, 20);
      
      // 各行をチェック
      lines.forEach(line => {
        // 行頭に禁則文字がないことを確認
        expect(line).not.toMatch(/^[、。！？]/);
        
        // 行の長さが20±1文字以内であることを確認（多少の余裕を持たせる）
        const lineWidth = line.split('').reduce((total, char) => total + getCharWidth(char), 0);
        expect(lineWidth).toBeLessThanOrEqual(21); // 禁則処理により若干超える場合を許容
      });
    });

    it('handles punctuation correctly', () => {
      const text = 'これは、テストです。';
      const lines = wrapTextWithKinsoku(text, 10);
      
      // 句読点が行頭に来ていないことを確認
      lines.forEach(line => {
        expect(line).not.toMatch(/^[、。]/);
      });
    });

    it('handles brackets correctly', () => {
      const text = 'これは（括弧のテスト）です【記号】も含みます。';
      const lines = wrapTextWithKinsoku(text, 15);
      
      // 行末禁則と行頭禁則をチェック
      lines.forEach(line => {
        expect(line).not.toMatch(/^[）】]/); // 行頭に来てはいけない
        expect(line).not.toMatch(/[（【]$/); // 行末に来てはいけない
      });
    });
  });

  describe('SRT parsing and formatting', () => {
    const sampleSrt = `1
00:00:00,000 --> 00:00:03,000
これは、非常に長いテストテキストです、句読点の処理を確認します。

2
00:00:03,000 --> 00:00:06,000
２番目の字幕（括弧付き）【記号も含む】テストです。`;

    it('parses SRT correctly', () => {
      const entries = parseSrt(sampleSrt);
      
      expect(entries).toHaveLength(2);
      expect(entries[0].index).toBe(1);
      expect(entries[0].startTime).toBe('00:00:00,000');
      expect(entries[0].endTime).toBe('00:00:03,000');
      expect(entries[0].text).toBe('これは、非常に長いテストテキストです、句読点の処理を確認します。');
    });

    it('formats SRT with kinsoku rules', () => {
      const formatted = formatSrt(sampleSrt, { maxZenkaku: 20 });
      const entries = parseSrt(formatted);
      
      // 各エントリのテキストが適切に整形されていることを確認
      entries.forEach(entry => {
        const lines = entry.text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            // 行頭に句読点が来ていないことを確認
            expect(line).not.toMatch(/^[、。！？]/);
          }
        });
      });
    });

    it('preserves timing information during formatting', () => {
      const formatted = formatSrt(sampleSrt);
      const originalEntries = parseSrt(sampleSrt);
      const formattedEntries = parseSrt(formatted);
      
      expect(formattedEntries).toHaveLength(originalEntries.length);
      
      formattedEntries.forEach((entry, index) => {
        expect(entry.startTime).toBe(originalEntries[index].startTime);
        expect(entry.endTime).toBe(originalEntries[index].endTime);
        expect(entry.index).toBe(originalEntries[index].index);
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty input', () => {
      const result = formatSrt('');
      expect(result).toBe('');
    });

    it('handles single character lines', () => {
      const text = 'あ';
      const lines = wrapTextWithKinsoku(text, 20);
      expect(lines).toEqual(['あ']);
    });

    it('handles lines with only punctuation', () => {
      const text = '。！？';
      const lines = wrapTextWithKinsoku(text, 20);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('handles mixed Japanese and English text', () => {
      const text = 'This is mixed テキストです、English and 日本語が混在しています。';
      const lines = wrapTextWithKinsoku(text, 20);
      
      lines.forEach(line => {
        // 基本的な禁則処理が適用されていることを確認
        expect(line).not.toMatch(/^[、。]/);
      });
    });
  });
});