import { describe, expect, it, beforeEach, vi } from 'vitest';
import memfs from 'memfs';
import { Session } from '../session';
import { loadFile } from './file';

vi.mock('fs', () => ({ ['default']: memfs.fs }));

beforeEach(() => memfs.vol.reset());

const session = new Session();

describe('loadFile', () => {
  it('invalid notebook does not error', async () => {
    memfs.vol.fromJSON({ 'notebook.ipynb': '{"invalid_notebook": "yes"}' });
    expect(await loadFile(session, 'notebook.ipynb')).toEqual(undefined);
  });
});
