const loadedScripts = new Set<string>();

/**
 * Loads a gateway's own script from its own CDN — never mirrored, see
 * README. `async = false` is deliberate: some gateway SDKs (PayU's Bolt
 * included) locate their own asset base via `document.currentScript` on
 * first execution, which is unreliable for `async` dynamically-inserted
 * scripts and silently breaks their asset loading. Setting it false makes
 * the browser treat this like a normal parser-inserted script for
 * `document.currentScript` purposes while still loading it lazily.
 */
export function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Orcopay: failed to load script ${src}`));
    document.head.append(script);
  });
}
