export default class PasteClipboard {
  private upload: (files: File[]) => void;
  private element: Element;
  private handler: EventListener;
  private listenerOptions: AddEventListenerOptions;

  constructor(upload: (files: globalThis.File[]) => void, element: Element) {
    this.upload = upload;
    this.element = element;
    this.handler = this.paste.bind(this) as EventListener;
    this.listenerOptions = { capture: true };
    element.addEventListener('paste', this.handler, this.listenerOptions);
  }

  unload(): void {
    this.element.removeEventListener('paste', this.handler, this.listenerOptions);
  }

  paste(e: ClipboardEvent): void {
    if (!e.clipboardData) return;

    const files: globalThis.File[] = Array.from(e.clipboardData.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    );

    if (!files.length && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      this.upload(files);
    }
  }
}
