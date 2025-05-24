# Sidebar Components

This directory contains sidebar-related components for the hasyx project.

## Components

### SidebarLayout

Main layout component that includes sidebar navigation and header with user profile.

```tsx
import { SidebarLayout } from 'hasyx/components/sidebar/layout';

<SidebarLayout
  sidebarData={sidebarData}
  breadcrumb={[
    { title: 'Home', link: '/' },
    { title: 'Dashboard', link: '/dashboard' },
  ]}
>
  {children}
</SidebarLayout>
```

### UserProfileDropdown

User profile dropdown component that shows:

**For authenticated users:**
- User name and avatar/initials in a rounded button
- Dropdown menu with:
  - User information (name, email)
  - Connected accounts list with provider icons
  - Sign out button

**For unauthenticated users:**
- "Sign in" button
- Dropdown menu with OAuth provider buttons

```tsx
import { UserProfileDropdown } from 'hasyx/components/sidebar/user-profile-dropdown';

// Used automatically in SidebarLayout
<UserProfileDropdown />
```

## Features

- **Authentication Status**: Automatically detects user authentication state
- **Connected Accounts**: Shows all OAuth accounts connected to the user
- **Provider Icons**: Beautiful SVG icons for Google, GitHub, Yandex, Facebook, VK, Telegram
- **Loading States**: Smooth loading indicators during authentication checks
- **Real-time Data**: Uses GraphQL subscriptions to show up-to-date account information
- **Responsive Design**: Hides user name on small screens, shows only avatar

## Dependencies

- `next-auth/react` - For authentication
- `hasyx` - For GraphQL queries and session management
- `@radix-ui/react-dropdown-menu` - For dropdown menus
- `@radix-ui/react-avatar` - For user avatars
- `lucide-react` - For icons

## Usage with Authentication

The components automatically integrate with the hasyx authentication system:

1. Uses `useSession()` from hasyx to get user session
2. Uses `useSubscription()` to get real-time account data from the database
3. Calls `signOut()` and `signIn()` from next-auth for authentication actions
4. Shows OAuth provider buttons from `OAuthButtons` component

## Styling

Components use Tailwind CSS classes and are compatible with the hasyx design system. 