/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPLIT_SCREEN_MODE?: string;
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
