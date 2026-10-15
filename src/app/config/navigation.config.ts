// src/app/core/config/navigation.config.ts

export interface NavSubItem {
    name: string;
    labelKey: string; // Clave de traducción del texto visible
    path: string;
    pro?: boolean;
    new?: boolean;
    section: string;
}

export interface NavItem {
    name: string; // Identificador estable (no se muestra)
    labelKey: string; // Clave de traducción del texto visible
    icon: string; // Nombre del icono de Google Symbols
    path?: string;
    new?: boolean;
    section: string; // Define a qué sección pertenece
    subItems?: NavSubItem[];
}

export interface SectionIcon {
    [key: string]: string;
}

// Configuración de items de navegación
export const NAV_ITEMS: NavItem[] = [
    { icon: 'home', name: 'Inicio', labelKey: 'SHELL.NAV.HOME', path: '/', section: 'Menu' },
    { icon: 'apartment', name: 'Mi empresa', labelKey: 'SHELL.NAV.MY_COMPANY', path: '/onboarding', section: 'Menu' },
    { icon: 'inventory_2', name: 'Mis servicios', labelKey: 'SHELL.NAV.MY_SERVICES', path: '/services', section: 'Menu' },
    { icon: 'verified_user', name: 'Cumplimiento', labelKey: 'SHELL.NAV.COMPLIANCE', path: '/cumplimiento', section: 'Menu' },
    // Se suma el dashboard cuando exista.
];

// Clave de traducción del título de cada sección del menú.
export const SECTION_LABEL_KEYS: { [key: string]: string } = {
    'Menu': 'SHELL.NAV.SECTION_MENU',
};

// Mapeo de iconos para secciones cuando el sidebar está colapsado
export const SECTION_ICONS: SectionIcon = {
    'Menu': 'menu',
    'Charts': 'bar_chart',
    'UI Elements': 'widgets',
    'Tables': 'table_chart',
    'Authentication': 'lock',
    'Settings': 'settings',
    'Help': 'help'
};

// Funciones helper para trabajar con la navegación
export class NavigationHelper {
    static getSections(items: NavItem[]): string[] {
        return [...new Set(items.map(item => item.section))];
    }

    static getItemsBySection(items: NavItem[], section: string): NavItem[] {
        return items.filter(item => item.section === section);
    }

    static getSectionIcon(section: string, sectionIcons: SectionIcon): string {
        return sectionIcons[section] || 'more_horiz';
    }
}