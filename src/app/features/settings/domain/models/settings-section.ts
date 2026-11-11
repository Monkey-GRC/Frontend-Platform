// Las secciones del área de Ajustes, agrupadas por lo que la persona viene a hacer. Sumar una sección es sumar una fila a su grupo (o un grupo nuevo) aquí y su ruta hija
// en app.routes.ts.
export interface SettingsSection {
  name: string; // identificador estable (no se muestra)
  labelKey: string;
  path: string; // relativo a /ajustes
}

export interface SettingsGroup {
  name: string; // identificador estable (no se muestra)
  labelKey: string;
  sections: SettingsSection[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    name: 'account',
    labelKey: 'SETTINGS.GROUPS.ACCOUNT',
    sections: [{ name: 'security', labelKey: 'SETTINGS.SECTIONS.SECURITY', path: 'seguridad' }],
  },
];
