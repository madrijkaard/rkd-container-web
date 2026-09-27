export type DockerfileTokenKind = 'plain' | 'instruction' | 'comment' | 'string' | 'variable' | 'option' | 'number';

export interface DockerfileToken {
  text: string;
  kind: DockerfileTokenKind;
}

export interface DockerfileLine {
  number: number;
  tokens: DockerfileToken[];
}

const INSTRUCTIONS = new Set([
  'ADD', 'ARG', 'CMD', 'COPY', 'ENTRYPOINT', 'ENV', 'EXPOSE', 'FROM',
  'HEALTHCHECK', 'LABEL', 'MAINTAINER', 'ONBUILD', 'RUN', 'SHELL',
  'STOPSIGNAL', 'USER', 'VOLUME', 'WORKDIR',
]);

const ARGUMENT_TOKEN = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|--[A-Za-z][A-Za-z0-9-]*(?:=[^\s\\]+)?|\b\d+(?:\.\d+)?\b/g;

function argumentTokens(value: string): DockerfileToken[] {
  const tokens: DockerfileToken[] = [];
  let cursor = 0;

  for (const match of value.matchAll(ARGUMENT_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: value.slice(cursor, index), kind: 'plain' });
    const text = match[0];
    const kind: DockerfileTokenKind = text.startsWith('"') || text.startsWith("'")
      ? 'string'
      : text.startsWith('$') ? 'variable'
        : text.startsWith('--') ? 'option' : 'number';
    tokens.push({ text, kind });
    cursor = index + text.length;
  }

  if (cursor < value.length) tokens.push({ text: value.slice(cursor), kind: 'plain' });
  return tokens;
}

export function highlightDockerfile(source: string): DockerfileLine[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();

  return lines.map((line, index) => {
    if (/^\s*#/.test(line)) {
      return { number: index + 1, tokens: [{ text: line, kind: 'comment' }] };
    }

    const instruction = /^(\s*)([A-Za-z]+)(?=\s|$)/.exec(line);
    if (instruction && INSTRUCTIONS.has(instruction[2].toUpperCase())) {
      const prefix = instruction[1];
      const keyword = instruction[2];
      return {
        number: index + 1,
        tokens: [
          ...(prefix ? [{ text: prefix, kind: 'plain' as const }] : []),
          { text: keyword, kind: 'instruction' as const },
          ...argumentTokens(line.slice(prefix.length + keyword.length)),
        ],
      };
    }

    return { number: index + 1, tokens: argumentTokens(line) };
  });
}
