/// <reference types="vite/client" /> // v4.4.0

// Environment variable type definitions for the AGENT AI Platform
interface ImportMetaEnv {
  /** Base URL for the platform's API endpoints */
  readonly VITE_API_URL: string;
  /** Auth0 domain for authentication */
  readonly VITE_AUTH0_DOMAIN: string;
  /** Auth0 client ID for application identification */
  readonly VITE_AUTH0_CLIENT_ID: string;
  /** Auth0 API audience identifier */
  readonly VITE_AUTH0_AUDIENCE: string;
}

// Type augmentation of import.meta
interface ImportMeta {
  /** Environment variables with type safety */
  readonly env: ImportMetaEnv;
}

// Asset module declarations for supported file types
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

declare module "*.avif" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}