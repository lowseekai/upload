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

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }

  pasteFrom(editor, items) {
    const event = {
      target: editor,
      clipboardData: { items },
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    this.listeners.get('paste')?.(event);
    return event;
  }
}

const container = new FakeElement();
const firstEditor = {};
const secondEditor = {};
const imageFile = { name: 'pasted.png' };
const uploads = [];
const listener = new PasteClipboard((files) => uploads.push(files), container);

const firstPaste = container.pasteFrom(firstEditor, [{ type: 'image/png', getAsFile: () => imageFile }]);
assert.equal(firstPaste.prevented, true);
assert.equal(uploads.length, 1);
assert.equal(uploads[0][0], imageFile);

const secondPaste = container.pasteFrom(secondEditor, [{ type: 'image/png', getAsFile: () => imageFile }]);
assert.equal(secondPaste.prevented, true);
assert.equal(uploads.length, 2);

const textPaste = container.pasteFrom(secondEditor, [{ type: 'text/plain', getAsFile: () => null }]);
assert.equal(textPaste.prevented, false);
assert.equal(uploads.length, 2);

listener.unload();
const afterUnload = container.pasteFrom(secondEditor, [{ type: 'image/png', getAsFile: () => imageFile }]);
assert.equal(afterUnload.prevented, false);
assert.equal(uploads.length, 2);

console.log('PasteClipboard smoke test passed');
