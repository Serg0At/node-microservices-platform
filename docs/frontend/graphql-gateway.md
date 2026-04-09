# GraphQL Gateway — Frontend Developer Reference

**Single entry point for all frontend clients.** You never call individual microservices — everything goes through one GraphQL endpoint. The gateway handles authentication, authorization, and routing to the correct backend service.

---

## Quick Start

### Endpoint

```text
POST https://api.arbex.com/graphql
```

### Minimal fetch call

```js
const res = await fetch('https://api.arbex.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `query { articles(limit: 10) { success articles { id title slug } } }`
  })
});
const { data, errors } = await res.json();
```

---

## Client Setup (Apollo Client — recommended)

Set this up once. It automatically attaches the token to every request and silently refreshes it when it expires.

```ts
// lib/apollo.ts
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const httpLink = createHttpLink({ uri: 'https://api.arbex.com/graphql' });

// Attach access token to every request
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

// Handle expired token — refresh silently, then retry
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const isUnauthenticated = graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED');
  if (isUnauthenticated) {
    return new Observable(observer => {
      refreshTokens().then(newToken => {
        if (!newToken) { signOut(); return; }
        operation.setContext(({ headers }) => ({
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        }));
        forward(operation).subscribe(observer);
      });
    });
  }
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});
```

---

## Token Management

| Token | Lifetime | Where to store | Purpose |
| --- | --- | --- | --- |
| `accessToken` | 1 hour | Memory | Sent as `Authorization` header on every request |
| `refreshToken` | 30 days | HttpOnly cookie | Used only to get a new `accessToken` when it expires |

```ts
// auth.ts
export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export async function refreshTokens(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const res = await fetch('https://api.arbex.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation RefreshTokens($refreshToken: String!) {
        refreshTokens(refreshToken: $refreshToken) { accessToken refreshToken }
      }`,
      variables: { refreshToken },
    }),
  });

  const { data } = await res.json();
  if (!data?.refreshTokens) return null;

  saveTokens(data.refreshTokens.accessToken, data.refreshTokens.refreshToken);
  return data.refreshTokens.accessToken;
}
```

---

## Error Handling

GraphQL always returns HTTP 200. Errors come in the `errors` array in the response body.

```ts
// Expected error shape
{
  errors: [{
    message: "Account has been banned",
    extensions: {
      code: "FORBIDDEN",      // UNAUTHENTICATED | FORBIDDEN | BAD_USER_INPUT | INTERNAL | RATE_LIMITED
      status: 403
    }
  }],
  data: null
}
```

```ts
// Handling errors with Apollo
const { data, error } = useMutation(LOGIN_MUTATION);

if (error?.graphQLErrors) {
  for (const err of error.graphQLErrors) {
    switch (err.extensions?.code) {
      case 'UNAUTHENTICATED': redirect('/login'); break;
      case 'FORBIDDEN':       showBannedMessage(); break;
      case 'BAD_USER_INPUT':  showValidationError(err.message); break;
      case 'RATE_LIMITED':    showMessage('Too many attempts, wait a moment'); break;
    }
  }
}
```

**Rate limits** — hitting these returns `RATE_LIMITED`:

| Operation | Limit |
| --- | --- |
| `register` | 5 per minute |
| `login` | 10 per minute |
| `forgotPassword`, `resetPassword` | 3 per minute |
| `createCheckout` | 5 per minute |

---

## Auth Flows

### Standard Login

```text
login → save tokens → redirect to app
```

```ts
const LOGIN = gql`
  mutation Login($emailUsername: String!, $password: String!) {
    login(emailUsername: $emailUsername, password: $password) {
      success
      requires2FA
      user { id email username }
      tokens { accessToken refreshToken expiresIn }
    }
  }
`;

const [login] = useMutation(LOGIN);

async function handleLogin(emailUsername: string, password: string) {
  const { data } = await login({ variables: { emailUsername, password } });

  if (data.login.requires2FA) {
    // Store the short-lived token (valid 5 min), redirect to 2FA screen
    saveTokens(data.login.tokens.accessToken, '');
    router.push('/2fa');
    return;
  }

  saveTokens(data.login.tokens.accessToken, data.login.tokens.refreshToken);
  router.push('/dashboard');
}
```

### Login with 2FA

After `login` returns `requires2FA: true`, the short-lived `accessToken` is stored. Use it to call `verify2FA`:

```ts
const VERIFY_2FA = gql`
  mutation Verify2FA($code: String!) {
    verify2FA(code: $code) {
      success
      message
      accessToken
      refreshToken
    }
  }
`;

// Called from the 2FA code input screen
async function handleVerify2FA(code: string) {
  const { data } = await verify2FA({ variables: { code } });
  // Replace short-lived token with full session tokens
  saveTokens(data.verify2FA.accessToken, data.verify2FA.refreshToken);
  router.push('/dashboard');
}
```

### Registration

```ts
const REGISTER = gql`
  mutation Register($email: String!, $username: String!, $password: String!, $fingerprint: String) {
    register(email: $email, username: $username, password: $password, fingerprint: $fingerprint) {
      success
      user { id email username }
      tokens { accessToken refreshToken expiresIn }
    }
  }
`;

// FingerprintJS visitorId — used for trial abuse detection, send if available
const { data } = await register({
  variables: { email, username, password, fingerprint: await getFingerprint() }
});
saveTokens(data.register.tokens.accessToken, data.register.tokens.refreshToken);
```

### Google OAuth

```ts
// 1. Redirect user to Google, get back `code` and `state` in the callback URL
// 2. Exchange them here:

const OIDC_LOGIN = gql`
  mutation OIDCLogin($code: String!, $provider: String!, $state: String!) {
    oidcLogin(code: $code, provider: $provider, state: $state) {
      success
      user { id email externalId provider }
      tokens { accessToken refreshToken }
    }
  }
`;

const { data } = await oidcLogin({ variables: { code, provider: 'google', state } });
saveTokens(data.oidcLogin.tokens.accessToken, data.oidcLogin.tokens.refreshToken);
```

### Password Reset Flow

```text
forgotPassword → user gets email with code → verifyResetCode → resetPassword
```

```ts
// Step 1 — request reset code
await forgotPassword({ variables: { email } });
// Always shows success to prevent email enumeration

// Step 2 — validate code before showing the new-password form
const { data } = await verifyResetCode({ variables: { email, code } });
if (!data.verifyResetCode.success) showError('Invalid or expired code');

// Step 3 — set new password (consumes the code)
await resetPassword({ variables: { email, code, newPassword } });
```

### Change Password (authenticated)

```text
requestPasswordChange → user gets email link → confirmPasswordChange(token, newPassword)
```

```ts
// Step 1 — triggers an email to the logged-in user
await requestPasswordChange(); // no args — identity comes from the JWT

// Step 2 — user clicks link in email, link contains ?token=xxx
await confirmPasswordChange({ variables: { token, newPassword } });
```

---

## Queries Reference

### Public (no auth needed)

```ts
// Single article — fetch by ID or slug (one is enough)
const GET_ARTICLE = gql`
  query GetArticle($slug: String) {
    article(slug: $slug) {
      success
      article { id title slug content authorId coverImageUrl viewCount publishedAt tags categories { id name } }
    }
  }
`;

// Article list with pagination + filters
const GET_ARTICLES = gql`
  query GetArticles($page: Int, $limit: Int, $categoryId: Int) {
    articles(page: $page, limit: $limit, categoryId: $categoryId) {
      success
      articles { id title slug coverImageUrl publishedAt }
      pagination { page limit total totalPages }
    }
  }
`;

// Full-text search
const SEARCH_ARTICLES = gql`
  query SearchArticles($query: String!, $page: Int, $limit: Int) {
    searchArticles(query: $query, page: $page, limit: $limit) {
      success
      articles { id title slug publishedAt }
      pagination { total totalPages }
    }
  }
`;

// Categories
const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      success
      categories { id name slug description parentId }
    }
  }
`;

// Public profile
const GET_PROFILE = gql`
  query GetProfile($userId: String!) {
    profile(userId: $userId) { userId username displayName avatarUrl }
  }
`;
```

### Authenticated (`@auth`)

```ts
// Own profile
const ME = gql`
  query Me {
    me { userId username displayName avatarUrl }
  }
`;

// Notification inbox
const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int, $offset: Int, $readFilter: String) {
    notifications(limit: $limit, offset: $offset, readFilter: $readFilter) {
      success
      totalCount
      notifications { id type title body read createdAt sentAt }
    }
  }
`;

// Unread badge count
const UNREAD_COUNT = gql`
  query UnreadCount {
    unreadCount { success count }
  }
`;

// Current subscription
const MY_SUBSCRIPTION = gql`
  query MySubscription {
    mySubscription {
      success
      subscription { id subType freeTrial status startedAt endedAt gracePeriodEnd }
    }
  }
`;

// Check promo code before checkout
const VALIDATE_PROMO = gql`
  query ValidatePromoCode($code: String!, $planType: Int!, $durationMonths: Int!) {
    validatePromoCode(code: $code, planType: $planType, durationMonths: $durationMonths) {
      success valid discountType discountValue discountAmountCents finalPriceCents message
    }
  }
`;
```

### Admin only (`@requireRole(ADMIN)`)

```ts
const DASHBOARD_STATS = gql`
  query DashboardStats {
    dashboardStats {
      success totalUsers totalBanned totalArticles totalCategories totalViews articlesToday usersToday
    }
  }
`;

const ADMIN_USERS = gql`
  query AdminUsers($page: Int, $limit: Int, $search: String, $role: Int, $status: Int) {
    adminUsers(page: $page, limit: $limit, search: $search, role: $role, status: $status) {
      success
      users { id email username role status createdAt bannedAt banReason }
      pagination { page limit total totalPages }
    }
  }
  # role:   -1 = all | 0 = user | 1 = admin
  # status: -1 = all | 0 = active | 1 = banned
`;

const ADMIN_USER = gql`
  query AdminUser($userId: String!) {
    adminUser(userId: $userId) {
      success
      user { id email username role status bannedAt banReason createdAt }
    }
  }
`;

const SUBSCRIPTION_STATS = gql`
  query SubscriptionStats {
    subscriptionStats {
      success totalActive totalExpired totalCanceled totalTerminated
      byTier { tier count }
    }
  }
`;

const ADMIN_ARTICLE_STATS = gql`
  query AdminArticleStats {
    adminArticleStats { success totalArticles totalBlog totalNews totalViews }
  }
`;
```

---

## Mutations Reference

### Auth

```ts
const LOGOUT = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken) { success message }
  }
`;

const REFRESH_TOKENS = gql`
  mutation RefreshTokens($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) { accessToken refreshToken }
  }
`;

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) { success message }
  }
`;

const FORGOT_PASSWORD = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email) { success message }
  }
`;

const VERIFY_RESET_CODE = gql`
  mutation VerifyResetCode($email: String!, $code: String!) {
    verifyResetCode(email: $email, code: $code) { success message }
  }
`;

const RESET_PASSWORD = gql`
  mutation ResetPassword($email: String!, $code: String!, $newPassword: String!) {
    resetPassword(email: $email, code: $code, newPassword: $newPassword) { success message }
  }
`;

const REQUEST_PASSWORD_CHANGE = gql`
  mutation { requestPasswordChange { success message } }
`;

const CONFIRM_PASSWORD_CHANGE = gql`
  mutation ConfirmPasswordChange($token: String!, $newPassword: String!) {
    confirmPasswordChange(token: $token, newPassword: $newPassword) { success message }
  }
`;
```

### 2FA

```ts
const SETUP_2FA = gql`
  mutation {
    setup2FA {
      success
      qrCode      # base64 PNG — render as: <img src={qrCode} />
      secret      # display for manual authenticator entry
      backupCodes # show ONCE, user must save these
    }
  }
`;

const VERIFY_2FA = gql`
  mutation Verify2FA($code: String!) {
    verify2FA(code: $code) { success message accessToken refreshToken }
  }
`;
```

### Profile

```ts
const UPDATE_PROFILE = gql`
  mutation UpdateProfile($username: String, $displayName: String) {
    updateProfile(username: $username, displayName: $displayName) {
      success message
      profile { userId username displayName avatarUrl }
    }
  }
`;

// Convert file to base64 before sending
const UPLOAD_AVATAR = gql`
  mutation UploadAvatar($imageBase64: String!, $contentType: String!, $fileName: String!) {
    uploadAvatar(imageBase64: $imageBase64, contentType: $contentType, fileName: $fileName) {
      success message avatarUrl
      profile { userId avatarUrl }
    }
  }
`;

// Example: file input → base64
async function handleAvatarUpload(file: File) {
  const base64 = await fileToBase64(file); // strip the data:image/...;base64, prefix
  await uploadAvatar({ variables: { imageBase64: base64, contentType: file.type, fileName: file.name } });
}
```

### Notifications

```ts
const MARK_AS_READ = gql`
  mutation MarkAsRead($notificationId: String!) {
    markAsRead(notificationId: $notificationId) { success message }
  }
`;

const MARK_ALL_AS_READ = gql`
  mutation { markAllAsRead { success message updatedCount } }
`;

const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($notificationId: String!) {
    deleteNotification(notificationId: $notificationId) { success message }
  }
`;
```

### Articles (authenticated user)

```ts
const CREATE_ARTICLE = gql`
  mutation CreateArticle($title: String!, $content: String!, $categoryId: Int!, $tags: [String!], $coverImageUrl: String, $status: Int) {
    createArticle(title: $title, content: $content, categoryId: $categoryId, tags: $tags, coverImageUrl: $coverImageUrl, status: $status) {
      success
      article { id title slug publishedAt }
    }
  }
`;

const UPDATE_ARTICLE = gql`
  mutation UpdateArticle($id: String!, $title: String, $content: String, $categoryId: Int, $tags: [String!], $coverImageUrl: String, $status: Int) {
    updateArticle(id: $id, title: $title, content: $content, categoryId: $categoryId, tags: $tags, coverImageUrl: $coverImageUrl, status: $status) {
      success
      article { id title slug updatedAt }
    }
  }
`;

const DELETE_ARTICLE = gql`
  mutation DeleteArticle($id: String!) {
    deleteArticle(id: $id) { success message }
  }
`;

// Get a pre-signed URL → upload image directly from browser → use fileUrl as coverImageUrl
const GET_UPLOAD_URL = gql`
  mutation GetUploadUrl($filename: String!, $contentType: String!, $articleId: String) {
    getUploadUrl(filename: $filename, contentType: $contentType, articleId: $articleId) {
      success uploadUrl fileUrl expiresIn
    }
  }
`;

// After getting uploadUrl, PUT the file directly:
async function uploadCoverImage(file: File, articleId?: string) {
  const { data } = await getUploadUrl({ variables: { filename: file.name, contentType: file.type, articleId } });
  await fetch(data.getUploadUrl.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  return data.getUploadUrl.fileUrl; // use this as coverImageUrl
}
```

### Subscription

```ts
// subType: 1 = Lite | 2 = Standard | 3 = PRO
// paymentMethod: "crypto" | "card"
// durationMonths: 1 | 3 | 6 | 12

const CREATE_CHECKOUT = gql`
  mutation CreateCheckout($planType: Int!, $paymentMethod: String!, $durationMonths: Int!, $promoCode: String) {
    createCheckout(planType: $planType, paymentMethod: $paymentMethod, durationMonths: $durationMonths, promoCode: $promoCode) {
      success
      paymentUrl   # redirect user here
      orderId
      expiresIn
      proration { remainingDays remainingValueCents newPlanPriceCents discountCents finalPriceCents }
    }
  }
`;

const CANCEL_SUBSCRIPTION = gql`
  mutation { cancelSubscription { success subscription { status endedAt } } }
`;

const RESTORE_SUBSCRIPTION = gql`
  mutation { restoreSubscription { success subscription { status endedAt } } }
`;
```

### Admin — User Management

```ts
const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: String!, $role: Int!) {
    updateUserRole(userId: $userId, role: $role) { success message user { id role } }
  }
  # role: 0 = user | 1 = admin
`;

const BAN_USER = gql`
  mutation BanUser($userId: String!, $reason: String) {
    banUser(userId: $userId, reason: $reason) { success message }
  }
`;

const UNBAN_USER = gql`
  mutation UnbanUser($userId: String!) {
    unbanUser(userId: $userId) { success message }
  }
`;
```

### Admin — Articles

```ts
const ADMIN_CREATE_ARTICLE = gql`
  mutation AdminCreateArticle($title: String!, $content: String!, $type: String!, $coverImageUrl: String, $categories: [String!]) {
    adminCreateArticle(title: $title, content: $content, type: $type, coverImageUrl: $coverImageUrl, categories: $categories) {
      success article { id title slug type }
    }
  }
  # type: "blog" | "news"
`;

const ADMIN_DELETE_ARTICLE = gql`
  mutation AdminDeleteArticle($articleId: String!) {
    adminDeleteArticle(articleId: $articleId) { success message }
  }
`;

const ADMIN_GET_UPLOAD_URL = gql`
  mutation AdminGetUploadUrl($filename: String!, $contentType: String!, $articleId: String) {
    adminGetUploadUrl(filename: $filename, contentType: $contentType, articleId: $articleId) {
      success uploadUrl fileUrl expiresIn
    }
  }
`;
```

### Admin — Categories

```ts
const CREATE_CATEGORY = gql`
  mutation CreateCategory($name: String!, $description: String, $parentId: Int) {
    createCategory(name: $name, description: $description, parentId: $parentId) {
      success category { id name slug }
    }
  }
`;

const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: Int!, $name: String, $description: String, $parentId: Int) {
    updateCategory(id: $id, name: $name, description: $description, parentId: $parentId) {
      success category { id name slug }
    }
  }
`;

const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: Int!) {
    deleteCategory(id: $id) { success message }
  }
`;
```

### Admin — Subscriptions

```ts
const ADMIN_SET_SUBSCRIPTION = gql`
  mutation AdminSetSubscription($userId: String!, $subType: Int!, $durationMonths: Int!, $issuedBy: String!) {
    adminSetSubscription(userId: $userId, subType: $subType, durationMonths: $durationMonths, issuedBy: $issuedBy) {
      success subscription { id subType status startedAt endedAt }
    }
  }
`;

const ADMIN_REMOVE_SUBSCRIPTION = gql`
  mutation AdminRemoveSubscription($userId: String!, $reason: String) {
    adminRemoveSubscription(userId: $userId, reason: $reason) { success message }
  }
`;
```

### Admin — Promo Codes

```ts
const ADMIN_CREATE_PROMO = gql`
  mutation AdminCreatePromoCode($code: String!, $discountType: String!, $discountValue: Int!, $maxUses: Int, $applicableTiers: [Int!], $minDurationMonths: Int, $validUntil: String) {
    adminCreatePromoCode(code: $code, discountType: $discountType, discountValue: $discountValue, maxUses: $maxUses, applicableTiers: $applicableTiers, minDurationMonths: $minDurationMonths, validUntil: $validUntil) {
      success promoCode { id code discountType discountValue maxUses active }
    }
  }
  # discountType: "percentage" | "fixed"
  # maxUses: 0 = unlimited
`;

const ADMIN_LIST_PROMOS = gql`
  mutation AdminListPromoCodes($page: Int, $limit: Int, $activeOnly: Boolean) {
    adminListPromoCodes(page: $page, limit: $limit, activeOnly: $activeOnly) {
      success promoCodes { id code discountValue usedCount maxUses active validUntil } total
    }
  }
`;

const ADMIN_DEACTIVATE_PROMO = gql`
  mutation AdminDeactivatePromoCode($code: String!) {
    adminDeactivatePromoCode(code: $code) { success message }
  }
`;
```

### Admin — Notifications

```ts
const ADMIN_SEND_NOTIFICATION = gql`
  mutation AdminSendNotification($userId: String!, $email: String!, $subject: String!, $body: String!, $channel: String) {
    adminSendNotification(userId: $userId, email: $email, subject: $subject, body: $body, channel: $channel) {
      success message notificationId
    }
  }
  # channel: "email" (default) | "in_app"
`;

const ADMIN_SEND_BULK = gql`
  mutation AdminSendBulkNotification($subject: String!, $body: String!, $channel: String, $recipients: [BulkRecipientInput!]) {
    adminSendBulkNotification(subject: $subject, body: $body, channel: $channel, recipients: $recipients) {
      success message total sent failed
    }
  }
`;
```
