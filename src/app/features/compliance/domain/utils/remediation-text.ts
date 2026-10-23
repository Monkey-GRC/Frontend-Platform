export interface TextBlock {
  kind: 'p' | 'li';
  text: string;
}

// La guía de corrección llega con marcas de formato simples (**negrita**, *cursiva*, `código`, viñetas «- »). Se muestra como texto plano, párrafos y viñetas: nunca
// se interpreta como HTML ni como markdown, así que lo que venga no puede insertar nada en la pantalla.
const plain = (s: string): string =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim();

export function remediationBlocks(text: string): TextBlock[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): TextBlock => (/^[-•]\s+/.test(line) ? { kind: 'li', text: plain(line.replace(/^[-•]\s+/, '')) } : { kind: 'p', text: plain(line) }));
}