import { formatSrt, parseSrt, wrapTextWithKinsoku, getCharWidth } from '../src/lib/srt';

describe('SRT Library (API)', () => {
  describe('Character width calculation', () => {
    it('calculates widths correctly', () => {
      expect(getCharWidth('a')).toBe(0.5);
      expect(getCharWidth('あ')).toBe(1.0);
      expect(getCharWidth('ｱ')).toBe(0.5);
    });
  });

  describe('Kinsoku rules', () => {
    it('wraps text with kinsoku rules', () => {
      const text = 'これは、非常に長いテキストです、句読点が行頭に来ないようにします。';
      const lines = wrapTextWithKinsoku(text, 20);
      
      // 行頭に句読点が来ていないことを確認
      lines.forEach(line => {
        expect(line).not.toMatch(/^[、。！？]/);
      });
    });

    it('handles edge cases', () => {
      expect(wrapTextWithKinsoku('', 20)).toEqual(['']);
      expect(wrapTextWithKinsoku('あ', 20)).toEqual(['あ']);
    });
  });

  describe('SRT formatting', () => {
    it('formats SRT maintaining structure', () => {
      const sampleSrt = `1
00:00:00,000 --> 00:00:03,000
これは非常に長いテキストです、句読点の処理を確認します。

2
00:00:03,000 --> 00:00:06,000
２番目の字幕です。`;

      const formatted = formatSrt(sampleSrt);
      const entries = parseSrt(formatted);
      
      expect(entries).toHaveLength(2);
      
      // タイミング情報が保持されていることを確認
      expect(entries[0].startTime).toBe('00:00:00,000');
      expect(entries[0].endTime).toBe('00:00:03,000');
      
      // 禁則処理が適用されていることを確認
      entries.forEach(entry => {
        const lines = entry.text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            expect(line).not.toMatch(/^[、。！？]/);
          }
        });
      });
    });

    it('handles malformed SRT gracefully', () => {
      const malformedSrt = 'invalid srt content';
      const result = formatSrt(malformedSrt);
      
      // エラーを投げずに何らかの結果を返すことを確認
      expect(typeof result).toBe('string');
    });
  });

  describe('Performance considerations', () => {
    it('handles long text efficiently', () => {
      const longText = 'あいうえお'.repeat(1000) + '。';
      const startTime = Date.now();
      
      const lines = wrapTextWithKinsoku(longText, 20);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1秒以内に処理が完了することを確認
      expect(duration).toBeLessThan(1000);
      expect(lines.length).toBeGreaterThan(0);
    });
  });
});