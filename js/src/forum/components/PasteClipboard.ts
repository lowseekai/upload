export default class PasteClipboard {
  private upload: (files: File[]) => void;
  private element: Element;
  private handler: EventListener;

  constructor(upload: (files: globalThis.File[]) => void, element: Element) {
    this.upload = upload;
    this.element = element;
    this.handler = this.paste.bind(this) as EventListener;
    element.addEventListener('paste', this.handler);
  }

  unload(): void {
    this.element.removeEventListener('paste', this.handler);
  }

  paste(e: ClipboardEvent): void {
    if (e.clipboardData?.items) {
      const items = e.clipboardData.items;
      const files: globalThis.File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        this.upload(files);
      }
    }
  }
}
