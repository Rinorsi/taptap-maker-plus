declare module React {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          ar?: boolean;
          "environment-image"?: string;
          "skybox-image"?: string;
          "shadow-intensity"?: string;
          "exposure"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
