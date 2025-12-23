// menu.config.ts
export interface MenuItem {
  label: string;
  href?: string;          // only for leaf nodes
  children?: MenuItem[];  // nested buttons
}

export const profileMenu: MenuItem[] = [
  {
    label: 'Account',
    children: [
      {
        label: 'Profile',
        href: '/profile',
      },
      {
        label: 'Settings',
        href: '/settings',
      },
    ],
  },
  {
    label: 'Library',
    children: [
      {
        label: 'My Books',
        href: '/my-books',
      },
      {
        label: 'Bookmarks',
        href: '/bookmarks',
      },
    ],
  },
  {
    label: 'Support',
    href: '/support',
  },
   {
    label: 'Tools',
    children: [
      {
        label: 'My Books',
        href: '/my-books',
      },
       {
    label: 'personal',
    children: [
      {
        label: 'My Books',
        href: '/my-books',
      },
      {
        label: 'recorder',
        href: '/part',
      },
    ],
  },
    ],
  },
];
