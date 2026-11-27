// Cómo se presenta un archivo elegido antes de subirlo (la vista previa de la zona de evidencia): la etiqueta de su tipo, el icono de su tipo y si es una imagen
// (que se ve en miniatura). Es pura: la extensión manda; el tipo MIME solo sirve si el nombre no tiene extensión.

export interface FileKind {
  /** La extensión en mayúsculas («PDF», «XLSX»); sin extensión, la parte final del tipo MIME o «—». */
  label: string;
  /** El icono (Material Symbols) del tipo: documento, hoja de cálculo, imagen, PDF o genérico. */
  icon: string;
  /** Imagen que el navegador sabe pintar: se muestra en miniatura. */
  image: boolean;
}

const ICONS: Record<string, string> = {
  pdf: 'picture_as_pdf',
  doc: 'description',
  docx: 'description',
  odt: 'description',
  txt: 'description',
  xls: 'table_chart',
  xlsx: 'table_chart',
  csv: 'table_chart',
  ods: 'table_chart',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  zip: 'folder_zip',
};
const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

export function fileKind(file: Pick<File, 'name' | 'type'>): FileKind {
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 && dot < file.name.length - 1 ? file.name.slice(dot + 1).toLowerCase() : '';
  const mimeTail = (file.type.split('/')[1] ?? '').toLowerCase();
  const key = ext || mimeTail;
  return {
    label: key ? key.toUpperCase() : '—',
    icon: ICONS[key] ?? 'draft',
    image: IMAGES.has(key) || (!ext && file.type.startsWith('image/')),
  };
}
