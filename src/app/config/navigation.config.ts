// src/app/core/config/navigation.config.ts

export interface NavSubItem {
    name: string;
    labelKey: string; // Clave de traducción del texto visible
    path: string;
    pro?: boolean;
    new?: boolean;
    section: string;
    roles?: string[]; // Same meaning as in NavItem: a child can be narrower than its parent
}

export interface NavItem {
    name: string; // Identificador estable (no se muestra)
    labelKey: string; // Clave de traducción del texto visible
    icon: string; // Nombre del icono de Google Symbols
    path?: string; // A simple item navigates to it. A group never navigates: its `path`, if any, only tells the menu that a page belongs to the group
    new?: boolean;
    section: string; // Define a qué sección pertenece
    roles?: string[]; // Si se da, solo estos roles ven el elemento (la barrera real es el backend)
    subItems?: NavSubItem[]; // Children of a group: the title of the group only opens or closes them; a parent with no visible child behaves as a simple item
}

export type SectionIcon = Record<string, string>;

// Configuración de items de navegación
export const NAV_ITEMS: NavItem[] = [
    // Qué ve cada rol (D102, MD-196). El responsable y el delegado entran por «Mi trabajo»; el inicio de la empresa es del administrador y del auditor.
    { icon: 'home', name: 'Inicio', labelKey: 'SHELL.NAV.HOME', path: '/', section: 'Menu', roles: ['admin_empresa', 'auditor'] },
    { icon: 'assignment_ind', name: 'Mi trabajo', labelKey: 'SHELL.NAV.MY_WORK', path: '/mi-trabajo', section: 'Menu', roles: ['responsable', 'delegado'] },
    // Groups (design system): the title only opens or closes; every page is a child (so «Mi empresa» and «Equipo» list their own page first).
    {
        icon: 'apartment', name: 'Mi empresa', labelKey: 'SHELL.NAV.MY_COMPANY', section: 'Menu', roles: ['admin_empresa'],
        subItems: [
            { name: 'Contexto de la empresa', labelKey: 'SHELL.NAV.COMPANY_CONTEXT', path: '/onboarding', section: 'Menu', roles: ['admin_empresa'] },
            { name: 'Mis servicios', labelKey: 'SHELL.NAV.MY_SERVICES', path: '/services', section: 'Menu', roles: ['admin_empresa'] },
        ],
    },
    // Cumplimiento es un grupo: cada sección es una página (sin id; el servicio activo se elige en el encabezado). Todos los roles ven las seis, como antes las pestañas.
    // El `path` del grupo es solo para marcarlo «con la sección activa» también en `/cumplimiento` (el General), que no es una sección.
    {
        icon: 'verified_user', name: 'Cumplimiento', labelKey: 'SHELL.NAV.COMPLIANCE', path: '/cumplimiento', section: 'Menu',
        subItems: [
            { name: 'Resumen', labelKey: 'COMPLIANCE.SECTIONS.SUMMARY', path: '/cumplimiento/resumen', section: 'Menu' },
            { name: 'Riesgos', labelKey: 'COMPLIANCE.GLOSSARY.RISKS', path: '/cumplimiento/riesgos', section: 'Menu' },
            { name: 'Causas', labelKey: 'COMPLIANCE.GLOSSARY.CAUSES', path: '/cumplimiento/causas', section: 'Menu' },
            { name: 'Controles', labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS', path: '/cumplimiento/controles', section: 'Menu' },
            { name: 'Evidencias', labelKey: 'COMPLIANCE.GLOSSARY.EVIDENCE', path: '/cumplimiento/evidencias', section: 'Menu' },
            { name: 'Exclusiones', labelKey: 'COMPLIANCE.SECTIONS.EXCLUSIONS', path: '/cumplimiento/exclusiones', section: 'Menu' },
        ],
    },
    // La asignación de controles es una sola pantalla: el administrador asigna el dueño; el responsable, el ejecutor entre sus delegados (MD-199, MD-200).
    { icon: 'assignment_turned_in', name: 'Asignar ejecutor', labelKey: 'SHELL.NAV.ASSIGN_EXECUTOR', path: '/asignacion', section: 'Menu', roles: ['responsable'] },
    // The owner's team: a group as well, so that «Grupos» (where they create their team) is reachable. `/equipo` redirects to the first child.
    {
        icon: 'groups', name: 'Mi equipo', labelKey: 'SHELL.NAV.MY_TEAM', section: 'Menu', roles: ['responsable'],
        subItems: [
            { name: 'Personas', labelKey: 'SHELL.NAV.TEAM_PEOPLE', path: '/equipo/personas', section: 'Menu', roles: ['responsable'] },
            { name: 'Grupos', labelKey: 'SHELL.NAV.TEAM_GROUPS', path: '/equipo/grupos', section: 'Menu', roles: ['responsable'] },
        ],
    },
    // The auditor reads «Cargos responsables» but has no team: for them it stays a simple item. The administrator reaches it under «Equipo».
    { icon: 'badge', name: 'Responsables', labelKey: 'SHELL.NAV.RESPONSIBLES', path: '/responsables', section: 'Menu', roles: ['auditor'] },
    {
        icon: 'groups', name: 'Equipo', labelKey: 'SHELL.NAV.TEAM', section: 'Menu', roles: ['admin_empresa'],
        subItems: [
            { name: 'Personas', labelKey: 'SHELL.NAV.TEAM_PEOPLE', path: '/equipo/personas', section: 'Menu', roles: ['admin_empresa'] },
            { name: 'Grupos', labelKey: 'SHELL.NAV.TEAM_GROUPS', path: '/equipo/grupos', section: 'Menu', roles: ['admin_empresa'] },
            { name: 'Cargos responsables', labelKey: 'SHELL.NAV.RESPONSIBLES', path: '/responsables', section: 'Menu', roles: ['admin_empresa'] },
        ],
    },
    { icon: 'assignment_turned_in', name: 'Asignación', labelKey: 'SHELL.NAV.ASSIGNMENT', path: '/asignacion', section: 'Menu', roles: ['admin_empresa'] },
    // Se suma el dashboard cuando exista.
];

// Clave de traducción del título de cada sección del menú.
export const SECTION_LABEL_KEYS: Record<string, string> = {
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