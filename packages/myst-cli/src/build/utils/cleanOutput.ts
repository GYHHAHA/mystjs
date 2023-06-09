import fs from 'node:fs';
import type { ISession } from '../../session/types.js';

export function cleanOutput(session: ISession, output: string) {
  if (fs.existsSync(output)) {
    session.log.info(`🧹 Cleaning old output at ${output}`);
    fs.rmSync(output, { recursive: true });
  }
}
