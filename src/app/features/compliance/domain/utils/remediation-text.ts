export interface TextBlock {
  /** `p` párrafo · `li` viñeta · `code` un comando o varias líneas de comandos, para leer y copiar aparte. */
  kind: 'p' | 'li' | 'code';
  text: string;
}

// La guía de corrección llega con marcas de formato simples (**negrita**, *cursiva*, `código`, viñetas «- », y los comandos en un bloque entre tres comillas invertidas).
// Se muestra como texto plano, párrafos, viñetas y bloques de código: nunca se interpreta como HTML ni como markdown, así que lo que venga no puede insertar nada en la pantalla.
const plain = (s: string): string =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim();

const prose = (text: string): TextBlock[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): TextBlock => (/^[-•]\s+/.test(line) ? { kind: 'li', text: plain(line.replace(/^[-•]\s+/, '')) } : { kind: 'p', text: plain(line) }));

// Un bloque de código es lo que hay entre dos líneas con ```. Se conserva TAL CUAL (sin quitar marcas ni espacios de dentro): un comando alterado le haría daño al servidor.
// Si el bloque no se cierra, no se interpreta: se muestra como texto, nunca se pierde.
export function remediationBlocks(text: string): TextBlock[] {
  const out: TextBlock[] = [];
  const fence = /```[^\n]*\r?\n([\s\S]*?)```/g;
  let last = 0;
  for (const m of text.matchAll(fence)) {
    out.push(...prose(text.slice(last, m.index)));
    const code = m[1].replace(/\s+$/, '').replace(/^\r?\n/, '');
    if (code.trim()) out.push({ kind: 'code', text: code });
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(...prose(text.slice(last)));
  return out;
}
