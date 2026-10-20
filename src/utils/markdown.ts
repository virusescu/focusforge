// Markdown collapses multiple blank lines into one paragraph break. Each extra blank line
// becomes a zero-width-space line so the spacing typed in the editor survives in the preview.
// lineMap[renderedLine] = source line, so task toggles target the right line in the source.
export function preserveBlankLines(source: string): { rendered: string; lineMap: number[] } {
  const originalLines = source.split('\n');
  const resultLines: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < originalLines.length; i++) {
    resultLines.push(originalLines[i]);
    map.push(i);
    if (originalLines[i] === '' && i > 0 && i < originalLines.length - 1) {
      let consecutive = 0;
      let j = i + 1;
      while (j < originalLines.length && originalLines[j] === '') {
        consecutive++;
        j++;
      }
      for (let k = 0; k < consecutive; k++) {
        resultLines.push('​');
        map.push(i + 1 + k);
      }
    }
  }
  return { rendered: resultLines.join('\n'), lineMap: map };
}

// Flips the task checkbox on a source line. Returns null if that line has no checkbox.
export function toggleTaskLine(source: string, lineIndex: number): { source: string; checked: boolean } | null {
  const lines = source.split('\n');
  const line = lines[lineIndex];
  if (!line) return null;
  if (/\[ \]/.test(line)) {
    lines[lineIndex] = line.replace('[ ]', '[x]');
    return { source: lines.join('\n'), checked: true };
  }
  if (/\[x\]/i.test(line)) {
    lines[lineIndex] = line.replace(/\[x\]/i, '[ ]');
    return { source: lines.join('\n'), checked: false };
  }
  return null;
}
