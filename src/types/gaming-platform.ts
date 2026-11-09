export interface GamingApp {
  id: string;
  name: string;
  tagline: string;
  description: string;
  playUrl: string;
  category: 'fish' | 'slots' | 'all-in-one';
  tags: string[];
  features: string[];
  platforms: ('android' | 'ios' | 'web' | 'pc')[];
  logoUrl?: string;
  badge?: string;
  accentColor?: string;
  displayOrder?: number;
  isActive?: boolean;
}

