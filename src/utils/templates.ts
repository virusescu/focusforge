// `$$` (escape) must be tried before `$name`, so `$$bla` is a literal `$bla` and not a field
const TOKEN = /\$\$|\$([A-Za-z_][A-Za-z0-9_]*)/g;

// Field names in first-appearance order, scanning the title and then the details
export function extractFields(title: string, details: string): string[] {
  const fields: string[] = [];
  for (const text of [title, details]) {
    for (const match of text.matchAll(TOKEN)) {
      const name = match[1];
      if (name !== undefined && !fields.includes(name)) fields.push(name);
    }
  }
  return fields;
}

// One pass: values are inserted verbatim and never re-expanded. A missing value becomes ''.
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN, (_match, name: string | undefined) => (name === undefined ? '$' : values[name] ?? ''));
}
