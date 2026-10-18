const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/forum/components/PasteClipboard.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
const PasteClipboard = compiledModule.exports.default;

class FakeElement {
  listeners = new Map();
  listenerOptions = new Map();

  addEventListener(name, listener, options) {
    this.listeners.set(name, listener);
    this.listenerOptions.set(name, options);
  }

  removeEventListener(name, listener, options) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
    if (this.listenerOptions.get(name) === options) this.listenerOptions.delete(name);
  }

  pasteFrom(editor, { files = [], items = [] } = {}) {
    const event = {
      target: editor,
      clipboardData: { files, items },
      prevented: false,
      stopped: false,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
    };
    this.listeners.get('paste')?.(event);
    return event;
  }
}

const container = new FakeElement();
const firstEditor = {};
const secondEditor = {};
const imageFile = { name: 'pasted.png', type: 'image/png' };
const uploads = [];
const listener = new PasteClipboard((files) => uploads.push(files), container);
assert.equal(container.listenerOptions.get('paste').capture, true);

const firstPaste = container.pasteFrom(firstEditor, { files: [imageFile] });
assert.equal(firstPaste.prevented, true);
assert.equal(firstPaste.stopped, true);
assert.equal(uploads.length, 1);
assert.equal(uploads[0][0], imageFile);

const secondPaste = container.pasteFrom(secondEditor, {
  items: [{ type: 'image/png', getAsFile: () => imageFile }],
});
assert.equal(secondPaste.prevented, true);
assert.equal(secondPaste.stopped, true);
assert.equal(uploads.length, 2);

const textPaste = container.pasteFrom(secondEditor, {
  items: [{ type: 'text/plain', getAsFile: () => null }],
});
assert.equal(textPaste.prevented, false);
assert.equal(textPaste.stopped, false);
assert.equal(uploads.length, 2);

listener.unload();
assert.equal(container.listeners.has('paste'), false);
const afterUnload = container.pasteFrom(secondEditor, { files: [imageFile] });
assert.equal(afterUnload.prevented, false);
assert.equal(afterUnload.stopped, false);
assert.equal(uploads.length, 2);

console.log('PasteClipboard smoke test passed');
