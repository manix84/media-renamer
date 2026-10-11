/// <reference types="vite/client" />

interface Window {
  mediaRenamer?: {
    pickFiles(): Promise<string[]>;
  };
}
