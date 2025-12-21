export interface Book {
  id: number;
  title: string;
  subtitle?: string;
  price: number;
  currency: string;
  coverUrl: string; // Changed from coverColor
  category: 'beginner' | 'advanced' | 'devops';
}