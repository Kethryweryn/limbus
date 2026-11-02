// Menu latéral (US-114) : liens et sections, partagés par la mise en page et ses composants
export type NavLink = { label: string, to: string, icon: string }
export type NavSection = { label: string, icon: string, links: NavLink[] }
