// src/app/core/config/navigation.config.ts

export interface NavSubItem {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    section: string;
}

export interface NavItem {
    name: string;
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
    // Sección "Menu"
    {
        icon: 'dashboard',
        name: "Dashboard",
        path: "/",
        section: "Menu",
    },
    {
        icon: 'shield',
        name: "Templates",
        path: "/templates",
        section: "Menu",
    },
];

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