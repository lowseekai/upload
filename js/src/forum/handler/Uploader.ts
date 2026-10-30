import app from 'flarum/forum/app';
import type File from '../../common/models/File';
import type FileListState from '../../common/states/FileListState';

type NativeFile = globalThis.File;

interface UploadResponse {
  file: File;
  addBBcode: boolean;
}

interface ApiUploadResponse {
  data: Array<{ type: string; id: string; attributes: Record<string, unknown> }>;
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default class Uploader {
  private callbacks: {
    success: Array<(response: UploadResponse) => void>;
    failure: Array<(response: unknown) => void>;
    uploading: Array<(files: FileList | NativeFile[]) => void>;
    uploaded: Array<() => void>;
  } = {
    success: [],
    failure: [],
    uploading: [],
    uploaded: [],
  };

  uploading = false;
  fileState?: FileListState;

  setState(fileState: FileListState): void {
    this.fileState = fileState;
  }

  on(type: 'success' | 'failure' | 'uploading' | 'uploaded', callback: (response?: unknown) => void): void {
    this.callbacks[type].push(callback as () => void);
  }

  private dispatch(type: keyof typeof this.callbacks, response?: unknown): void {
    this.callbacks[type].forEach((callback) => callback(response as never));
  }

  upload(files: FileList | NativeFile[], addBBcode = true): Promise<void> {
    const fileArray = Array.from(files as Iterable<NativeFile>);

    // Reject oversized files before sending anything. The server can only
    // answer once it has received the whole body, so without this check the
    // composer sits on "uploading" for the length of the transfer and only
    // then reports an error — which reads as a stuck spinner for big files.
    if (!this.passesSizeLimit(fileArray)) {
      return Promise.resolve();
    }

    this.uploading = true;
    this.dispatch('uploading', files);
    m.redraw();

    const body = new FormData();
    for (let i = 0; i < fileArray.length; i++) {
      body.append('files[]', fileArray[i] as Blob);
    }

    return app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/fof/upload',
        serialize: (raw: FormData) => raw,
        body,
      })
      .then((result: unknown) => this.uploaded(result as ApiUploadResponse, addBBcode))
      .catch((error: { response?: { errors?: Array<{ code?: string; detail?: string }> } }) => {
        this.uploading = false;
        m.redraw();

        // Show whatever the server said — validation errors carry a readable
        // detail. Fall back to a generic message for opaque failures such as
        // an nginx 413 or a dropped connection, which used to surface as an
        // unhandled rejection with no feedback at all.
        const detail = error?.response?.errors?.[0]?.detail;

        app.alerts.clear();
        app.alerts.show({ type: 'error' }, detail ?? app.translator.trans('fof-upload.forum.validation.upload_failed'));

        if (!detail) {
          console.error('[fof/upload] upload failed', error);
        }
      });
  }

  /**
   * Whether every file is within the limit set in the admin panel.
   *
   * Shows an alert and returns false for the first oversized file, so nothing
   * is sent. The input is reset so the same file can be picked again.
   */
  private passesSizeLimit(files: NativeFile[]): boolean {
    const limitKb = Number(app.forum.attribute('fof-upload.maxFileSize')) || 0;

    if (limitKb <= 0) {
      return true;
    }

    const maxBytes = limitKb * 1024;
    const oversized = files.filter((file) => file.size > maxBytes);

    if (oversized.length === 0) {
      return true;
    }

    app.alerts.clear();
    app.alerts.show(
      { type: 'error' },
      app.translator.trans('fof-upload.forum.validation.too_large', {
        filename: oversized[0].name,
        size: humanSize(oversized[0].size),
        max: humanSize(maxBytes),
      })
    );

    this.dispatch('uploaded');
    m.redraw();

    return false;
  }

  private uploaded(result: ApiUploadResponse, addBBcode = false): void {
    this.uploading = false;

    result.data.forEach((file) => {
      const fileObj = app.store.pushObject(file) as File;
      this.fileState?.addToList(fileObj);
      this.dispatch('success', { file: fileObj, addBBcode });
    });

    this.dispatch('uploaded');
  }
}
