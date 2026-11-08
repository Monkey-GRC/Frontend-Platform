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
    roles?: string[]; // Si se da, solo estos roles ven el elemento (la barrera real es el backend)
    subItems?: NavSubItem[];
}

export interface SectionIcon {
    [key: string]: string;
}

// Configuración de items de navegación
export const NAV_ITEMS: NavItem[] = [
    // Qué ve cada rol (D102, MD-196). El responsable y el delegado entran por «Mi trabajo»; el inicio de la empresa es del administrador y del auditor.
    { icon: 'home', name: 'Inicio', labelKey: 'SHELL.NAV.HOME', path: '/', section: 'Menu', roles: ['admin_empresa', 'auditor'] },
    { icon: 'assignment_ind', name: 'Mi trabajo', labelKey: 'SHELL.NAV.MY_WORK', path: '/mi-trabajo', section: 'Menu', roles: ['responsable', 'delegado'] },
    { icon: 'apartment', name: 'Mi empresa', labelKey: 'SHELL.NAV.MY_COMPANY', path: '/onboarding', section: 'Menu', roles: ['admin_empresa'] },
    { icon: 'inventory_2', name: 'Mis servicios', labelKey: 'SHELL.NAV.MY_SERVICES', path: '/services', section: 'Menu', roles: ['admin_empresa'] },
    { icon: 'verified_user', name: 'Cumplimiento', labelKey: 'SHELL.NAV.COMPLIANCE', path: '/cumplimiento', section: 'Menu' },
    // La asignación de controles es una sola pantalla: el administrador asigna el dueño; el responsable, el ejecutor entre sus delegados (MD-199, MD-200).
    { icon: 'assignment_turned_in', name: 'Asignar ejecutor', labelKey: 'SHELL.NAV.ASSIGN_EXECUTOR', path: '/asignacion', section: 'Menu', roles: ['responsable'] },
    { icon: 'groups', name: 'Mi equipo', labelKey: 'SHELL.NAV.MY_TEAM', path: '/equipo', section: 'Menu', roles: ['responsable'] },
    { icon: 'badge', name: 'Responsables', labelKey: 'SHELL.NAV.RESPONSIBLES', path: '/responsables', section: 'Menu', roles: ['admin_empresa', 'auditor'] },
    { icon: 'groups', name: 'Equipo', labelKey: 'SHELL.NAV.TEAM', path: '/equipo', section: 'Menu', roles: ['admin_empresa'] },
    { icon: 'assignment_turned_in', name: 'Asignación', labelKey: 'SHELL.NAV.ASSIGNMENT', path: '/asignacion', section: 'Menu', roles: ['admin_empresa'] },
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