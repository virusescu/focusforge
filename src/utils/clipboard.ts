export async function copyRich(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(plain);
  }
}

export async function copyPlain(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
